import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Kartu error untuk data yang gagal dimuat, dengan tombol "Try again".
 * `error` boleh apa saja (biasanya dari TanStack Query); pesan `Error` ditampilkan apa adanya,
 * selain itu dipakai `fallback`. `onRetry` biasanya `query.refetch`.
 */
export function ErrorState({
  error,
  fallback = "Something went wrong.",
  onRetry,
}: {
  error?: unknown;
  fallback?: string;
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error && error.message ? error.message : fallback;
  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger-soft grid justify-items-center gap-3 rounded-2xl border p-8 text-center"
    >
      <TriangleAlert size={26} className="text-danger" aria-hidden />
      <p className="text-foreground font-semibold">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
