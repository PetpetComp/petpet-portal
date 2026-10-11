import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tata letak halaman detail/form selebar konten: kolom utama di kiri, kolom samping
 * (ringkasan, aksi, status) di kanan pada layar lebar; menumpuk di HP.
 * Menggantikan `max-w-3xl` yang membuat sisi kanan halaman kosong.
 */
export function PageColumns({
  main,
  aside,
  className,
}: {
  main: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-start gap-5",
        aside && "xl:grid-cols-[minmax(0,1fr)_340px]",
        className,
      )}
    >
      <div className="grid min-w-0 gap-5">{main}</div>
      {aside && <aside className="grid min-w-0 gap-5">{aside}</aside>}
    </div>
  );
}

/** Kartu seksi putih bergaris untuk mengelompokkan field/isi (judul + deskripsi opsional). */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border grid min-w-0 gap-4 rounded-2xl border bg-white p-5",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {title && <h2 className="text-base font-bold">{title}</h2>}
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Daftar "label: nilai" dua kolom untuk kartu detail. Nilai kosong tampil "-". */
export function InfoList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="grid min-w-0 gap-0.5">
          <dt className="text-muted-foreground text-[13px] font-semibold">
            {item.label}
          </dt>
          <dd className="text-sm font-medium break-words">
            {item.value || "-"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
