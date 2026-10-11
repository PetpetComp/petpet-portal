"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHeight, formatWeight, petAgeLabel } from "@/domains/pets/format";
import { useDeletePet, usePet } from "@/domains/pets/queries";
import { speciesMorphLine, type Pet } from "@/domains/pets/types";
import { ROUTES } from "@/lib/constants/routes";
import { formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { PetAvatar } from "./pet-avatar";

/**
 * Halaman detail pet (`/pet-management/[petId]`). Layar ini tidak ada di desain:
 * diputuskan di kode mengikuti pola header event (breadcrumb, avatar, judul, aksi di kanan)
 * dan kartu informasi. Memuat pet lewat `usePet`; 403/404 dari server tampil sebagai ErrorState.
 * Dipanggil dari `[petId]/page.tsx`.
 */
export function PetDetailPage({ petId }: { petId: string }) {
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
      <div className="grid max-w-3xl gap-4" aria-busy aria-label="Loading pet">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  return <PetDetail pet={pet} />;
}

/** Isi halaman detail untuk satu pet yang sudah dimuat. Tombol aksi membaca `pet.actions` dari server. */
function PetDetail({ pet }: { pet: Pet }) {
  const router = useRouter();
  const remove = useDeletePet(pet.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { actions } = pet;

  /** Hapus pet; kegagalan (mis. 422 karena ada entry) tampil sebagai toast, pengguna tetap di halaman. */
  function deletePet() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success("Pet deleted");
        router.push(ROUTES.petManagement);
      },
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to delete the pet.",
        ),
    });
  }

  const age = petAgeLabel(pet.birthDate);

  return (
    <div className="grid max-w-3xl gap-5.5">
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
        <span className="text-foreground font-semibold">{pet.name}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <PetAvatar name={pet.name} speciesName={pet.speciesName} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-[32px] leading-10 font-bold break-words">
              {pet.name}
            </h1>
            <p className="text-muted-foreground">
              {speciesMorphLine(pet) || "-"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {actions.update && (
            <Link
              href={ROUTES.pets.edit(pet.id)}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "min-h-11 rounded-xl px-5 font-bold",
              )}
            >
              Edit
            </Link>
          )}
          {actions.delete && (
            <Button
              variant="destructive"
              className="min-h-11 rounded-xl px-5 font-bold"
              disabled={remove.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </header>

      <dl className="border-border grid gap-x-6 gap-y-4 rounded-2xl border bg-white p-6 sm:grid-cols-2">
        <Detail label="Owner">{pet.ownerName || "Your account"}</Detail>
        <Detail label="Registration number">
          {pet.registrationNumber || "-"}
        </Detail>
        <Detail label="Gender">{pet.gender || "-"}</Detail>
        <Detail label="Date of birth">
          {pet.birthDate
            ? `${formatDate(pet.birthDate)}${age ? ` (${age})` : ""}`
            : "-"}
        </Detail>
        <Detail label="Height">{formatHeight(pet.heightCm) || "-"}</Detail>
        <Detail label="Weight">{formatWeight(pet.weightGrams) || "-"}</Detail>
        <Detail label="Welfare check">
          {pet.welfareStatus.charAt(0) +
            pet.welfareStatus.slice(1).toLowerCase()}
        </Detail>
      </dl>

      {/* Hak ubah ada tapi hak hapus tidak: satu-satunya sebab di kontrak adalah pet sudah punya entry. */}
      {actions.update && !actions.delete && (
        <p className="text-muted-foreground">
          This pet cannot be deleted because it has competition entries.
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete pet"
        description={`Delete "${pet.name}"? This cannot be undone.`}
        confirmLabel="Delete pet"
        onConfirm={deletePet}
      />
    </div>
  );
}

/** Satu pasang label dan nilai di kartu informasi. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-[13px] font-semibold">
        {label}
      </dt>
      <dd className="font-semibold break-words">{children}</dd>
    </div>
  );
}
