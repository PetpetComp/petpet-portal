import Link from "next/link";
import { brandInitials } from "@/domains/sponsors/types";
import { cardContactLines, type Brand } from "@/domains/brands/types";
import { ROUTES } from "@/lib/constants/routes";

/**
 * Kotak inisial brand (contoh "HT") di kartu daftar dan header detail. Brand belum punya logo
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

/**
 * Satu kartu brand di daftar (desain Brands): inisial, nama, slogan kampanye, lalu handle dan
 * telepon. Seluruh kartu adalah tautan ke detail brand. Dipanggil dari `BrandsPage`.
 * Slogan dan handle hanya tampil bila backend mengirimnya (di mode backend asli belum).
 */
export function BrandCard({ brand }: { brand: Brand }) {
  const { left, right } = cardContactLines(brand);
  return (
    <Link
      href={ROUTES.brands.detail(brand.id)}
      className="border-border hover:border-primary focus-visible:outline-ring grid gap-3 rounded-2xl border bg-white p-4.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="flex items-center gap-3">
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
      <span className="text-primary-dark flex justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate">{left ?? "No contact"}</span>
        {right && <span className="shrink-0">{right}</span>}
      </span>
    </Link>
  );
}
