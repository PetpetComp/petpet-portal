import type { ReactNode } from "react";

/** Judul halaman list: judul + deskripsi di kiri, tombol aksi utama ("New ...") di kanan. */
export function ListPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1.5">
        <h1 className="font-display text-[34px] leading-[38px] font-bold">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-[15px]">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
