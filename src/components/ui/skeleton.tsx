import { cn } from "@/lib/utils";

/**
 * Blok abu berdenyut sebagai pengganti konten yang sedang dimuat.
 * Atur ukuran lewat `className`, contoh: `<Skeleton className="h-4 w-40" />`.
 * Disembunyikan dari pembaca layar; area yang memuat sebaiknya memberi `aria-busy`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-muted block animate-pulse rounded-lg", className)}
    />
  );
}
