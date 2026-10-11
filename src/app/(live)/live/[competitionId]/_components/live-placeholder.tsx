import { Hourglass } from "lucide-react";

/** Halaman sementara untuk langkah Live Mode yang belum dibangun (Matches, Results). */
export function LivePlaceholder({ step }: { step: string }) {
  return (
    <div className="mx-auto mt-16 grid max-w-md justify-items-center gap-3 px-4 text-center">
      <span className="bg-primary-soft text-primary-dark grid size-14 place-items-center rounded-2xl">
        <Hourglass size={26} aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold">{step}</h1>
      <p className="text-muted-foreground">Coming in the next phase.</p>
    </div>
  );
}
