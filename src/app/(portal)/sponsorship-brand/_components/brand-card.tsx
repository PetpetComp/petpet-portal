import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { brandInitials } from "@/domains/sponsors/types";
import {
  brandStatusLabel,
  cardContactLines,
  type Brand,
} from "@/domains/brands/types";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

/**
 * Kotak inisial brand (contoh "HT") di daftar dan header detail. Brand belum punya logo
 * (belum ada kolomnya di API), jadi inisial yang tampil. `size` "lg" dipakai di header detail.
 */
export function BrandAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={
        "bg-foreground font-display grid shrink-0 place-items-center font-extrabold text-white " +
        (size === "lg"
          ? "size-16 rounded-2xl text-xl"
          : "size-13 rounded-[14px] text-base")
      }
    >
      {brandInitials(name)}
    </span>
  );
}

/** Kolom grid baris brand pada layar >= md (harus sama dengan header kolom di BrandsPage). */
export const BRAND_ROW_COLUMNS =
  "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_72px_110px_20px]";

/**
 * Satu baris brand di daftar: di layar kecil tampil sebagai kartu bertumpuk, di layar >= md
 * menjadi baris tabel (brand, kontak, jumlah PIC, status, panah). Seluruh baris adalah satu
 * tautan ke detail. Dipanggil dari `BrandsPage`. Slogan dan handle hanya tampil bila backend
 * mengirimnya (di mode backend asli belum), email menggantikan handle.
 */
export function BrandCard({ brand }: { brand: Brand }) {
  const { left, right } = cardContactLines(brand);
  return (
    <Link
      href={ROUTES.brands.detail(brand.id)}
      className={cn(
        "hover:bg-primary-soft/40 focus-visible:outline-ring grid items-center gap-3 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
        BRAND_ROW_COLUMNS,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <BrandAvatar name={brand.name} />
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-base">{brand.name}</b>
          {brand.campaign && (
            <span className="text-muted-foreground truncate">
              &ldquo;{brand.campaign}&rdquo;
            </span>
          )}
        </span>
      </span>
      <span className="text-primary-dark flex min-w-0 flex-col text-[13px]">
        <span className="truncate">{left ?? "No contact"}</span>
        {right && <span className="text-muted-foreground">{right}</span>}
      </span>
      <span className="text-muted-foreground md:text-foreground text-[13px] md:text-sm">
        <span className="md:hidden">PICs: </span>
        {brand.pics.length}
      </span>
      <span>
        <StatusBadge
          status={brand.status}
          label={brandStatusLabel(brand.status)}
        />
      </span>
      <ChevronRight
        size={16}
        aria-hidden
        className="text-muted-foreground hidden md:block"
      />
    </Link>
  );
}
