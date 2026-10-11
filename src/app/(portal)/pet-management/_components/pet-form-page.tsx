"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { PageColumns, SectionCard } from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { petFeatures, type PetFeatures } from "@/domains/pets/features";
import {
  useCreatePet,
  usePet,
  usePetMorphs,
  useSpecies,
  useUpdatePet,
} from "@/domains/pets/queries";
import {
  EMPTY_PET_FORM,
  formFromPet,
  formToApiBody,
  petFormSchema,
  serverErrorsToFormErrors,
  type PetForm,
  type PetFormValues,
} from "@/domains/pets/schema";
import { PET_GENDERS, morphsForSpecies, type Pet } from "@/domains/pets/types";
import type { UserHit } from "@/domains/users/types";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { ROUTES } from "@/lib/constants/routes";
import { PetAvatar } from "./pet-avatar";
import { PetOwnerPicker } from "./pet-owner-picker";

/** Halaman New pet (`/pet-management/create`). Dipanggil dari `create/page.tsx`. */
export function PetCreatePage() {
  return <PetFormShell title="New pet" back={ROUTES.petManagement} />;
}

/**
 * Halaman Edit pet (`/pet-management/[petId]/edit`): memuat pet, memeriksa `actions.update`
 * (hanya menyembunyikan halaman; backend tetap menegakkan), lalu menampilkan form yang sudah terisi.
 * Dipanggil dari `[petId]/edit/page.tsx`.
 */
export function PetEditPage({ petId }: { petId: string }) {
  const { pet, isError, error, refetch } = usePet(petId);

  if (isError)
    return (
      <ErrorState
        error={error}
        fallback="Unable to load this pet."
        onRetry={() => refetch()}
      />
    );
  if (!pet)
    return (
      <div className="grid gap-4" aria-busy aria-label="Loading pet">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  if (!pet.actions.update) return <Forbidden />;
  return (
    <PetFormShell
      title="Edit pet"
      back={ROUTES.pets.detail(pet.id)}
      pet={pet}
    />
  );
}

/**
 * Kerangka halaman form: breadcrumb, judul, lalu form. Layar create dan edit memakai form yang
 * sama. Form ini tidak ada di desain Pets: diputuskan di kode, memakai pola form Event
 * (halaman penuh selebar konten, kartu seksi di kolom utama, ringkasan dan aksi di samping) karena URL `/create` dan `/edit` dipertahankan.
 */
function PetFormShell({
  title,
  back,
  pet,
}: {
  title: string;
  back: string;
  pet?: Pet;
}) {
  const species = useSpecies();
  const morphs = usePetMorphs();
  // Form baru dibuat setelah master siap: pilihan morph harus sudah ada saat nilai awal Edit dipasang.
  const masterError = species.isError
    ? species
    : morphs.isError
      ? morphs
      : null;
  const masterReady = species.isSuccess && morphs.isSuccess;
  return (
    <div className="grid min-w-0 gap-5.5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-2"
      >
        <Link
          href={ROUTES.petManagement}
          className="text-primary font-semibold"
        >
          Pets
        </Link>
        <ChevronRight size={14} aria-hidden />
        {pet && (
          <>
            <Link href={back} className="text-primary font-semibold">
              {pet.name}
            </Link>
            <ChevronRight size={14} aria-hidden />
          </>
        )}
        <span className="text-foreground font-semibold">
          {pet ? "Edit" : "New pet"}
        </span>
      </nav>
      <h1 className="font-display text-[32px] leading-10 font-bold">{title}</h1>
      {masterError ? (
        <ErrorState
          error={masterError.error}
          fallback="Unable to load species and morphs."
          onRetry={() => void masterError.refetch()}
        />
      ) : masterReady ? (
        <PetFormCard pet={pet} back={back} />
      ) : (
        <Skeleton className="h-96 w-full rounded-2xl" />
      )}
    </div>
  );
}

/**
 * Form pet. Create (tanpa `pet`) dan Edit (dengan `pet`) berbagi field.
 * Spesies dan morph datang dari master; morph disaring menurut spesies terpilih dan di-reset
 * saat spesies berganti. Fitur yang belum didukung backend asli (pilih pemilik, ubah spesies/morph
 * saat Edit) diatur `petFeatures`. Galat 422 server dikembalikan ke field-nya.
 */
function PetFormCard({ pet, back }: { pet?: Pet; back: string }) {
  const router = useRouter();
  const { can } = useAuth();
  const features: PetFeatures = petFeatures(
    USING_MOCK_BACKEND,
    can(PERMISSION.USER_MANAGE),
  );
  const editing = pet !== undefined;
  const classificationLocked = editing && !features.editClassification;

  const species = useSpecies();
  const morphs = usePetMorphs();
  const create = useCreatePet();
  const update = useUpdatePet(pet?.id ?? "");
  const [owner, setOwner] = useState<UserHit | null>(null);

  const form = useForm<PetFormValues, unknown, PetForm>({
    resolver: zodResolver(petFormSchema),
    defaultValues: pet ? formFromPet(pet) : EMPTY_PET_FORM,
  });
  const { errors } = form.formState;
  const speciesId = useWatch({ control: form.control, name: "speciesId" });
  const morphOptions = morphsForSpecies(morphs.data ?? [], speciesId ?? "");
  const saving = create.isPending || update.isPending;

  /** Pilih pemilik (atau kembali ke akun sendiri bila null); id-nya disimpan di field form. */
  function chooseOwner(hit: UserHit | null) {
    setOwner(hit);
    form.setValue("ownerId", hit?.id ?? "");
  }

  /** Pesan 422 server ke field-nya; selain itu (403, 422 tanpa field) jadi toast. */
  function showSaveError(cause: unknown) {
    const fieldErrors =
      cause instanceof ApiError ? serverErrorsToFormErrors(cause.errors) : {};
    if (Object.keys(fieldErrors).length > 0) {
      for (const [field, message] of Object.entries(fieldErrors))
        form.setError(field as keyof PetFormValues, { message });
      return;
    }
    toast.error(
      cause instanceof Error ? cause.message : "Unable to save the pet.",
    );
  }

  const save = form.handleSubmit((values) => {
    const body = formToApiBody(values, {
      includeClassification: !classificationLocked,
      includeOwner: !editing && features.ownerPicker,
    });
    if (pet)
      update.mutate(body, {
        onSuccess: () => {
          toast.success("Pet updated");
          router.push(back);
        },
        onError: showSaveError,
      });
    else
      create.mutate(body, {
        onSuccess: (created) => {
          toast.success("Pet created");
          router.push(ROUTES.pets.detail(created.id));
        },
        onError: showSaveError,
      });
  });

  const watchedName = useWatch({ control: form.control, name: "name" });
  const speciesName =
    species.data?.find((item) => item.id === speciesId)?.name ?? "";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <PageColumns
        main={
          <>
            <SectionCard title="Owner">
              <div className="grid gap-2">
                {editing ? (
                  <p className="font-semibold">
                    {pet.ownerName || "Your account"}
                  </p>
                ) : features.ownerPicker ? (
                  <PetOwnerPicker owner={owner} onChange={chooseOwner} />
                ) : (
                  <p className="text-muted-foreground">
                    The pet is registered under your account.
                  </p>
                )}
                {errors.ownerId?.message && (
                  <span
                    role="alert"
                    className="text-danger-ink text-[13px] font-semibold"
                  >
                    {errors.ownerId.message}
                  </span>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Identity">
              <div className="grid gap-4.5 sm:grid-cols-2">
                <FormField
                  label="Pet name"
                  required
                  error={errors.name?.message}
                >
                  <input
                    {...form.register("name")}
                    type="text"
                    maxLength={150}
                    aria-invalid={!!errors.name}
                    className={fieldClass}
                  />
                </FormField>
                <FormField
                  label="Registration number"
                  error={errors.registrationNumber?.message}
                >
                  <input
                    {...form.register("registrationNumber")}
                    type="text"
                    maxLength={100}
                    placeholder="Optional"
                    aria-invalid={!!errors.registrationNumber}
                    className={fieldClass}
                  />
                </FormField>
                <FormField label="Gender" error={errors.gender?.message}>
                  <select
                    {...form.register("gender")}
                    aria-invalid={!!errors.gender}
                    className={fieldClass}
                  >
                    <option value="">Not set</option>
                    {PET_GENDERS.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Date of birth"
                  error={errors.birthDate?.message}
                >
                  <input
                    {...form.register("birthDate")}
                    type="date"
                    aria-invalid={!!errors.birthDate}
                    className={fieldClass}
                  />
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Species and traits">
              <div className="grid gap-4.5 sm:grid-cols-2">
                <FormField
                  label="Species"
                  required
                  error={errors.speciesId?.message}
                  hint={
                    classificationLocked
                      ? "Species and morph cannot be changed after the pet is created."
                      : undefined
                  }
                >
                  <select
                    {...form.register("speciesId", {
                      // Morph milik spesies lama tidak berlaku untuk spesies baru.
                      onChange: () => form.setValue("morphId", ""),
                    })}
                    disabled={classificationLocked}
                    aria-invalid={!!errors.speciesId}
                    className={fieldClass}
                  >
                    <option value="">Choose a species</option>
                    {species.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Morph" error={errors.morphId?.message}>
                  <select
                    {...form.register("morphId")}
                    disabled={classificationLocked || !speciesId}
                    aria-invalid={!!errors.morphId}
                    className={fieldClass}
                  >
                    <option value="">
                      {speciesId ? "No morph" : "Choose a species first"}
                    </option>
                    {morphOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Height (cm)" error={errors.heightCm?.message}>
                  <input
                    {...form.register("heightCm")}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    aria-invalid={!!errors.heightCm}
                    className={fieldClass}
                  />
                </FormField>
                <FormField
                  label="Weight (g)"
                  error={errors.weightGrams?.message}
                >
                  <input
                    {...form.register("weightGrams")}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    aria-invalid={!!errors.weightGrams}
                    className={fieldClass}
                  />
                </FormField>
              </div>
            </SectionCard>
          </>
        }
        aside={
          <>
            <SectionCard title="Summary">
              <div className="flex min-w-0 items-center gap-3">
                <PetAvatar
                  name={watchedName ?? ""}
                  speciesName={speciesName}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {watchedName?.trim() || "Unnamed pet"}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {speciesName || "No species chosen"}
                  </p>
                </div>
              </div>
            </SectionCard>
            <SectionCard>
              <Button
                type="submit"
                disabled={saving}
                className="min-h-11 w-full rounded-xl px-5.5 font-bold"
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Create pet"}
              </Button>
              <Link
                href={back}
                className="text-primary-dark flex min-h-11 items-center justify-center rounded-xl px-4 font-bold"
              >
                Cancel
              </Link>
            </SectionCard>
          </>
        }
      />
    </form>
  );
}
