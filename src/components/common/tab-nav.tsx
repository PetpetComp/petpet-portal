"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Satu tab navigasi. `exact` = aktif hanya bila path sama persis (untuk tab Overview). */
export type TabNavItem = {
  label: string;
  href: string;
  exact?: boolean;
  /** Angka kecil di samping label. Kosong/undefined = tidak tampil. */
  count?: number | null;
};

/**
 * Bar tab berbasis link (desain EventHeader): garis bawah lilac pada tab aktif,
 * bisa digulir ke samping di layar sempit. Tab aktif ditentukan dari URL sekarang.
 * Dipakai header event; header kompetisi dapat memakainya juga.
 */
export function TabNav({
  label,
  items,
}: {
  label: string;
  items: TabNavItem[];
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="border-border flex gap-1 overflow-x-auto border-b"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-primary-dark flex min-h-11 items-center gap-1.5 border-b-2 px-3.5 whitespace-nowrap",
              active
                ? "border-primary font-bold"
                : "border-transparent font-semibold",
            )}
          >
            {item.label}
            {item.count != null && (
              <span className="text-muted-foreground font-semibold">
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
