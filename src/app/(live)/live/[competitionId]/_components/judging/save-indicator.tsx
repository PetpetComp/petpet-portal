"use client";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "./use-judging-autosave";

/**
 * Indikator autosave: Saved / Saving... / Offline - will retry / Not saved, dengan tombol Retry
 * saat gagal. `role="status"` agar pembaca layar mengumumkan perubahannya. Dipanggil dari
 * JudgingBoard. `idle` (belum ada edit) tidak menampilkan apa pun selain ruang kosong.
 */
export function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      className="flex min-h-6 items-center gap-2 text-xs font-semibold"
    >
      {status === "saving" && (
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />
          Saving...
        </span>
      )}
      {status === "saved" && (
        <span className="text-done flex items-center gap-1.5">
          <Check size={14} aria-hidden />
          Saved
        </span>
      )}
      {(status === "offline" || status === "error") && (
        <>
          <span className="text-danger-ink flex items-center gap-1.5">
            <CloudOff size={14} aria-hidden />
            {status === "offline"
              ? "Offline - will retry"
              : "Not saved - your changes are kept"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 px-3"
            onClick={onRetry}
          >
            Retry
          </Button>
        </>
      )}
    </div>
  );
}
