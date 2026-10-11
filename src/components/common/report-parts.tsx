import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Kartu angka laporan: label kecil, angka besar, catatan di bawah. `value` undefined = sedang
 * dimuat. Dipakai halaman Reports dan tab Reports event.
 */
export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode | undefined;
  note?: string;
}) {
  return (
    <div className="border-border grid min-w-0 gap-1 rounded-2xl border bg-white px-5 py-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <b className="font-display truncate text-[28px] leading-9">
        {value === undefined ? "…" : value}
      </b>
      {note && <span className="text-muted-foreground text-sm">{note}</span>}
    </div>
  );
}

export type ReportColumn = { label: string };

export type ReportRow = {
  key: string;
  title: string;
  subtitle?: string;
  /** Bila ada, judul baris menjadi tautan. */
  href?: string;
  /** Satu nilai per kolom, sudah berupa teks. */
  cells: string[];
};

/** Rata kanan kolom angka di layar lebar. */
const CELL = "sm:text-right";

/** Kolom grid layar lebar menurut jumlah kolom angka (kelas ditulis utuh agar Tailwind menemukannya). */
const GRID: Record<number, string> = {
  3: "sm:grid-cols-[minmax(0,1fr)_repeat(3,6rem)]",
  4: "sm:grid-cols-[minmax(0,1fr)_repeat(4,6rem)]",
  5: "sm:grid-cols-[minmax(0,1fr)_repeat(5,6rem)]",
};

/**
 * Tabel laporan yang rapi di HP: di layar lebar berupa baris dengan kolom angka sejajar,
 * di HP tiap baris menjadi kartu kecil (judul, lalu angka dengan labelnya). Baris `footer`
 * (Total) opsional; 3 sampai 5 kolom angka. Dipanggil dari halaman Reports dan tab Reports event.
 */
export function ReportRows({
  caption,
  nameLabel,
  columns,
  rows,
  footer,
}: {
  caption: string;
  /** Judul kolom nama di layar lebar (mis. "Competition"). */
  nameLabel: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  footer?: string[];
}) {
  const grid = GRID[columns.length] ?? GRID[4];
  return (
    <div role="table" aria-label={caption} className="min-w-0">
      <div
        role="row"
        className={cn(
          "text-muted-foreground border-border hidden gap-3 border-b px-1 pb-2 text-[13px] font-semibold sm:grid",
          grid,
        )}
      >
        <span role="columnheader">{nameLabel}</span>
        {columns.map((column) => (
          <span key={column.label} role="columnheader" className={CELL}>
            {column.label}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          role="row"
          className={cn(
            "border-border grid min-w-0 gap-x-3 gap-y-2 border-b px-1 py-3 sm:items-center",
            grid,
          )}
        >
          <div role="cell" className="min-w-0">
            {row.href ? (
              <Link
                href={row.href}
                className="text-primary block truncate font-semibold hover:underline"
              >
                {row.title}
              </Link>
            ) : (
              <span className="block truncate font-semibold">{row.title}</span>
            )}
            {row.subtitle && (
              <span className="text-muted-foreground block truncate text-sm">
                {row.subtitle}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:contents">
            {row.cells.map((cell, index) => (
              <div
                key={columns[index].label}
                role="cell"
                className="flex min-w-0 justify-between gap-2 sm:contents"
              >
                <dt className="text-muted-foreground text-sm sm:hidden">
                  {columns[index].label}
                </dt>
                <dd
                  className={cn(
                    "text-sm font-semibold whitespace-nowrap",
                    CELL,
                  )}
                >
                  {cell}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {footer && (
        <div
          role="row"
          className={cn(
            "grid min-w-0 gap-x-3 gap-y-2 px-1 pt-3 font-bold sm:items-center",
            grid,
          )}
        >
          <span role="cell">Total</span>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:contents">
            {footer.map((cell, index) => (
              <div
                key={columns[index].label}
                role="cell"
                className="flex min-w-0 justify-between gap-2 sm:contents"
              >
                <dt className="text-muted-foreground text-sm font-normal sm:hidden">
                  {columns[index].label}
                </dt>
                <dd className={cn("text-sm whitespace-nowrap", CELL)}>
                  {cell}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
