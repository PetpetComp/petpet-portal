"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Plus, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import {
  InfoList,
  PageColumns,
  SectionCard,
} from "@/components/common/page-layout";
import { StatusBadge } from "@/components/common/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBrand,
  useDeleteBrand,
  useRemoveBrandPic,
} from "@/domains/brands/queries";
import {
  brandStatusLabel,
  isBrandActive,
  type Brand,
  type BrandPic,
} from "@/domains/brands/types";
import { initials } from "@/lib/identity";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { AddPicDrawer } from "./add-pic-drawer";
import { BrandAvatar } from "./brand-card";

const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/**
 * Halaman detail brand (`/sponsorship-brand/[brandId]`): kolom utama (info brand, PIC) dan
 * kolom samping (ringkasan status, aksi).
 * Memuat brand lewat `useBrand`; PIC datang bersama response brand (backend belum punya
 * endpoint PIC sendiri). Dipanggil dari `[brandId]/page.tsx`.
 */
export function BrandDetailPage({ brandId }: { brandId: string }) {
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
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  return <BrandDetail brand={brand.data} />;
}

/** Isi halaman detail untuk brand yang sudah dimuat. */
function BrandDetail({ brand }: { brand: Brand }) {
  const router = useRouter();
  const remove = useDeleteBrand(brand.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const active = isBrandActive(brand);

  /** Menghapus (menonaktifkan) brand lalu kembali ke daftar. */
  function deleteBrand() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${brand.name} deleted`);
        router.push(ROUTES.sponsorshipBrand);
      },
      onError: (cause) =>
        toast.error(errorText(cause, "Unable to delete the brand.")),
    });
  }

  return (
    <div className="grid min-w-0 gap-5">
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
        <span className="text-foreground font-semibold">{brand.name}</span>
      </nav>

      <header className="flex min-w-0 items-center gap-4">
        <BrandAvatar name={brand.name} size="lg" />
        <div className="grid min-w-0 gap-1">
          <h1 className="font-display text-[32px] leading-10 font-bold break-words">
            {brand.name}
          </h1>
          {brand.campaign && (
            <span className="text-muted-foreground">
              &ldquo;{brand.campaign}&rdquo;
            </span>
          )}
        </div>
      </header>

      {!active && (
        <p
          role="status"
          className="bg-warning-soft rounded-xl px-4 py-3 text-sm font-semibold"
        >
          This brand is inactive. It no longer appears in the brand list or when
          adding sponsors to an event.
        </p>
      )}

      <PageColumns
        main={
          <>
            <InfoCard brand={brand} />
            <PicCard brand={brand} />
          </>
        }
        aside={
          <>
            <SectionCard title="Summary">
              <dl className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground font-semibold">
                    Status
                  </dt>
                  <dd>
                    <StatusBadge
                      status={brand.status}
                      label={brandStatusLabel(brand.status)}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground font-semibold">
                    People in charge
                  </dt>
                  <dd className="font-bold">{brand.pics.length}</dd>
                </div>
              </dl>
            </SectionCard>
            <SectionCard title="Actions">
              <div className="grid gap-2.5">
                <Link
                  href={ROUTES.brands.edit(brand.id)}
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "min-h-11 rounded-xl px-4.5 font-bold",
                  )}
                >
                  <Pencil size={16} aria-hidden />
                  Edit
                </Link>
                {active && (
                  <Button
                    variant="secondary"
                    className="text-danger-ink min-h-11 rounded-xl px-4.5 font-bold"
                    disabled={remove.isPending}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={16} aria-hidden />
                    Delete
                  </Button>
                )}
              </div>
            </SectionCard>
          </>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete brand"
        description={`Delete "${brand.name}"? It disappears from the brand list and can no longer be added to events. Events it is already linked to keep it.`}
        confirmLabel="Delete brand"
        onConfirm={deleteBrand}
      />
    </div>
  );
}

/** Kartu Brand info: telepon, email, website, handle, dan kampanye. Kolom kosong tampil "-". */
function InfoCard({ brand }: { brand: Brand }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Phone", value: brand.phone || "-" },
    {
      label: "Email",
      value: brand.email ? (
        <a href={`mailto:${brand.email}`} className="text-primary break-all">
          {brand.email}
        </a>
      ) : (
        "-"
      ),
    },
    {
      label: "Website",
      value: brand.websiteUrl ? (
        <a
          href={brand.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary break-all"
        >
          {brand.websiteUrl}
        </a>
      ) : (
        "-"
      ),
    },
  ];
  return (
    <SectionCard title="Brand info">
      <InfoList
        items={[
          ...rows,
          {
            label: "Instagram",
            value: brand.handle ? `@${brand.handle}` : null,
          },
          { label: "Campaign", value: brand.campaign },
        ]}
      />
    </SectionCard>
  );
}

/**
 * Kartu PIC: daftar PIC brand, tombol Add PIC (drawer cari user), dan Remove per PIC dengan
 * konfirmasi. Data PIC dari `brand.pics`; setelah tambah atau hapus, brand dimuat ulang.
 */
function PicCard({ brand }: { brand: Brand }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toRemove, setToRemove] = useState<BrandPic | null>(null);
  const remove = useRemoveBrandPic(brand.id);

  /** Melepas satu PIC setelah dikonfirmasi. */
  function removePic(pic: BrandPic) {
    remove.mutate(pic.userId, {
      onSuccess: () => toast.success(`${pic.name} removed`),
      onError: (cause) =>
        toast.error(errorText(cause, "Unable to remove the PIC.")),
    });
  }

  return (
    <SectionCard
      title={`PICs (${brand.pics.length})`}
      description="People we work with at this brand."
      action={
        <Button
          className="min-h-10 rounded-xl font-bold"
          onClick={() => setDrawerOpen(true)}
        >
          <Plus size={16} aria-hidden />
          Add PIC
        </Button>
      }
    >
      {brand.pics.length === 0 ? (
        <p className="text-muted-foreground">
          No PIC yet. Add the person we work with at this brand.
        </p>
      ) : (
        <ul aria-label="PICs" className="grid gap-2.5 md:grid-cols-2">
          {brand.pics.map((pic) => (
            <li
              key={pic.userId}
              className="border-border flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2"
            >
              <span
                aria-hidden
                className="bg-primary-soft text-primary-dark grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
              >
                {initials(pic.name, "?")}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="break-words">{pic.name || pic.email}</b>
                <span className="text-muted-foreground text-[13px] break-all">
                  {pic.email}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${pic.name || pic.email}`}
                disabled={remove.isPending}
                onClick={() => setToRemove(pic)}
              >
                <UserX size={18} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AddPicDrawer
        brandId={brand.id}
        existingPicIds={brand.pics.map((pic) => pic.userId)}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remove PIC"
        description={
          toRemove
            ? `Remove ${toRemove.name || toRemove.email} as a PIC of ${brand.name}? They keep their account.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={() => toRemove && removePic(toRemove)}
      />
    </SectionCard>
  );
}
