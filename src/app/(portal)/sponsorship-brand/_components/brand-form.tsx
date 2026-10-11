"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBrand,
  useCreateBrand,
  useUpdateBrand,
} from "@/domains/brands/queries";
import {
  EMPTY_BRAND_FORM,
  brandSchema,
  formFromBrand,
  serverErrorsToFormErrors,
  type BrandDetails,
  type BrandFormValues,
} from "@/domains/brands/schema";
import type { Brand } from "@/domains/brands/types";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { BrandAvatar } from "./brand-card";

/** Penelusuran roti (breadcrumb) di atas form: Brands > [nama brand] > Edit / New brand. */
function FormBreadcrumb({ brand }: { brand: Brand | null }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex flex-wrap items-center gap-2"
    >
      <Link
        href={ROUTES.sponsorshipBrand}
        className="text-primary font-semibold"
      >
        Brands
      </Link>
      <ChevronRight size={14} aria-hidden />
      {brand && (
        <>
          <Link
            href={ROUTES.brands.detail(brand.id)}
            className="text-primary font-semibold"
          >
            {brand.name}
          </Link>
          <ChevronRight size={14} aria-hidden />
        </>
      )}
      <span className="text-foreground font-semibold">
        {brand ? "Edit" : "New brand"}
      </span>
    </nav>
  );
}

/**
 * Form brand yang dipakai bersama oleh halaman New brand dan Edit brand.
 * Form dimiliki di sini (react-hook-form + `brandSchema`); penyimpanannya dilakukan pemanggil
 * lewat `onSave(details, onError)`. Pemanggil meneruskan `onError` ke mutasinya: pesan 422
 * server ditaruh di field-nya, galat lain jadi toast. `isSaving` mematikan tombol dan memberi
 * teks "Saving...". `cancelHref` = tujuan tautan Cancel.
 */
function BrandForm({
  initial,
  saveLabel,
  cancelHref,
  isSaving,
  onSave,
}: {
  initial: BrandFormValues;
  saveLabel: string;
  cancelHref: string;
  isSaving: boolean;
  onSave: (details: BrandDetails, onError: (cause: unknown) => void) => void;
}) {
  const form = useForm<BrandFormValues, unknown, BrandDetails>({
    resolver: zodResolver(brandSchema),
    defaultValues: initial,
  });
  const errors = form.formState.errors;
  const name = useWatch({ control: form.control, name: "brandName" });

  /** Menaruh pesan 422 per field; bila tidak ada yang cocok, tampilkan sebagai toast. */
  function showSaveError(cause: unknown) {
    const fieldErrors =
      cause instanceof ApiError ? serverErrorsToFormErrors(cause.errors) : {};
    if (Object.keys(fieldErrors).length > 0) {
      for (const [field, message] of Object.entries(fieldErrors))
        form.setError(field as keyof BrandFormValues, { message });
      return;
    }
    toast.error(
      cause instanceof Error ? cause.message : "Unable to save the brand.",
    );
  }

  const submit = form.handleSubmit((details) => onSave(details, showSaveError));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="border-border grid gap-4.5 rounded-2xl border bg-white p-6 sm:grid-cols-2"
    >
      <FormField
        label="Brand name"
        required
        error={errors.brandName?.message}
        className="sm:col-span-2"
      >
        <input
          {...form.register("brandName")}
          type="text"
          maxLength={200}
          aria-invalid={!!errors.brandName}
          className={fieldClass}
        />
      </FormField>
      <FormField label="Phone" error={errors.phone?.message}>
        <input
          {...form.register("phone")}
          type="tel"
          maxLength={30}
          placeholder="e.g. 081270000001"
          aria-invalid={!!errors.phone}
          className={fieldClass}
        />
      </FormField>
      <FormField label="Email" error={errors.email?.message}>
        <input
          {...form.register("email")}
          type="email"
          maxLength={255}
          placeholder="partnership@brand.com"
          aria-invalid={!!errors.email}
          className={fieldClass}
        />
      </FormField>
      <FormField
        label="Website"
        error={errors.websiteUrl?.message}
        className="sm:col-span-2"
      >
        <input
          {...form.register("websiteUrl")}
          type="url"
          maxLength={2048}
          placeholder="https://brand.com"
          aria-invalid={!!errors.websiteUrl}
          className={fieldClass}
        />
      </FormField>
      <div className="border-lilac-300 flex items-center gap-4 rounded-[14px] border-[1.5px] border-dashed p-4 sm:col-span-2">
        <BrandAvatar name={name || "Brand"} size="lg" />
        <span className="flex flex-1 flex-col">
          <b>Logo</b>
          <span className="text-muted-foreground text-[13px]">
            Logo upload is not available yet. Until then we show the initials.
          </span>
        </span>
        <Button
          variant="secondary"
          disabled
          title="Logo upload is not available yet"
          className="min-h-11 rounded-xl"
        >
          Upload
        </Button>
      </div>
      <div className="flex justify-between gap-3 pt-1.5 sm:col-span-2">
        <Link
          href={cancelHref}
          className="text-primary-dark flex min-h-11 items-center rounded-xl px-4 font-bold"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={isSaving}
          className="min-h-11 rounded-xl px-5.5 font-bold"
        >
          {isSaving ? "Saving..." : saveLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Halaman New brand (`/sponsorship-brand/create`). Setelah tersimpan, membuka detail brand baru
 * supaya PIC bisa langsung ditambahkan. Dipanggil dari `create/page.tsx`.
 */
export function BrandCreatePage() {
  const router = useRouter();
  const create = useCreateBrand();

  return (
    <div className="grid max-w-3xl gap-5.5">
      <FormBreadcrumb brand={null} />
      <h1 className="font-display text-[32px] leading-10 font-bold">
        New brand
      </h1>
      <BrandForm
        initial={EMPTY_BRAND_FORM}
        saveLabel="Create brand"
        cancelHref={ROUTES.sponsorshipBrand}
        isSaving={create.isPending}
        onSave={(details, onError) =>
          create.mutate(details, {
            onSuccess: (brand) => {
              toast.success("Brand created");
              router.push(ROUTES.brands.detail(brand.id));
            },
            onError,
          })
        }
      />
    </div>
  );
}

/**
 * Halaman Edit brand (`/sponsorship-brand/[brandId]/edit`): memuat brand, lalu menampilkan form
 * yang sama dengan New brand, sudah terisi. Dipanggil dari `[brandId]/edit/page.tsx`.
 */
export function BrandEditPage({ brandId }: { brandId: string }) {
  const brand = useBrand(brandId);

  if (brand.isError)
    return (
      <ErrorState
        error={brand.error}
        fallback="Unable to load this brand."
        onRetry={() => brand.refetch()}
      />
    );
  if (!brand.data)
    return (
      <div className="grid max-w-3xl gap-4" aria-busy>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  return <BrandEditForm brand={brand.data} />;
}

/** Form Edit yang sudah terisi dari `brand`. Hanya dirender setelah brand berhasil dimuat. */
function BrandEditForm({ brand }: { brand: Brand }) {
  const router = useRouter();
  const update = useUpdateBrand(brand.id);
  const back = ROUTES.brands.detail(brand.id);

  return (
    <div className="grid max-w-3xl gap-5.5">
      <FormBreadcrumb brand={brand} />
      <h1 className="font-display text-[32px] leading-10 font-bold">
        Edit brand
      </h1>
      <BrandForm
        initial={formFromBrand(brand)}
        saveLabel="Save changes"
        cancelHref={back}
        isSaving={update.isPending}
        onSave={(details, onError) =>
          update.mutate(details, {
            onSuccess: () => {
              toast.success("Brand updated");
              router.push(back);
            },
            onError,
          })
        }
      />
    </div>
  );
}
