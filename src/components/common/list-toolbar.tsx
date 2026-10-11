import type { ReactNode } from "react";
import { Search } from "lucide-react";

/**
 * Baris di atas tabel/grid: kotak pencarian di kiri, lalu slot kanan (`children`) untuk tombol
 * Filter dan kontrol lain. Pencarian dikontrol halaman (`value` + `onChange`), di-debounce di sana.
 */
export function ListToolbar({
  searchLabel,
  search,
  onSearchChange,
  children,
}: {
  /** Dipakai sebagai placeholder sekaligus aria-label. */
  searchLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="border-input focus-within:border-primary flex min-h-11 min-w-0 flex-1 basis-60 items-center gap-2 rounded-xl border bg-white px-3.5 sm:max-w-md">
        <Search
          size={16}
          aria-hidden="true"
          className="text-muted-foreground shrink-0"
        />
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
        />
      </label>
      {children}
    </div>
  );
}
