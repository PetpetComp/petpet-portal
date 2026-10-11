"use client";
import type { JudgingParticipant } from "@/domains/judging/types";
import { cn } from "@/lib/utils";

/**
 * Teks dan warna status satu peserta di antrean. Dipanggil dari JudgingQueue.
 * Peserta terpilih selalu "Now" (chip magenta); selain itu LOCKED/SUBMITTED -> Scored (hijau),
 * DRAFT -> Draft (kuning tua), NOT_SCORED -> Waiting.
 */
function statusOf(p: JudgingParticipant, selected: boolean) {
  if (selected)
    return {
      label: "Now",
      className:
        "bg-judging-accent/30 text-judging-ink rounded-full px-2.5 py-0.5",
    };
  if (p.status === "LOCKED" || p.status === "SUBMITTED")
    return { label: "Scored", className: "text-done" };
  if (p.status === "DRAFT")
    return { label: "Draft", className: "text-event-day-ink" };
  return { label: "Waiting", className: "text-muted-foreground" };
}

/**
 * Daftar antrean peserta menurut urutan check-in. Dipanggil dari JudgingBoard.
 * Input: peserta, id terpilih, callback pilih. Juri boleh membuka peserta mana pun.
 */
export function JudgingQueue({
  participants,
  selectedId,
  onSelect,
}: {
  participants: readonly JudgingParticipant[];
  selectedId: string | null;
  onSelect: (entryId: string) => void;
}) {
  return (
    <nav aria-label="Judging queue" className="grid content-start gap-2">
      <h2 className="text-muted-foreground text-xs font-bold tracking-widest">
        QUEUE
      </h2>
      <ul className="grid gap-2">
        {participants.map((p) => {
          const selected = p.entryId === selectedId;
          const status = statusOf(p, selected);
          return (
            <li key={p.entryId}>
              <button
                type="button"
                onClick={() => onSelect(p.entryId)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left",
                  selected
                    ? "border-judging-border bg-judging-soft"
                    : "bg-card hover:bg-muted border-transparent",
                )}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-semibold">{p.petName}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {p.bibNumber}
                  </span>
                </span>
                <span
                  className={cn("shrink-0 text-sm font-bold", status.className)}
                >
                  {status.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
