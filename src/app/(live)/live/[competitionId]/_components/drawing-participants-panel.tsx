import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DrawingMatch, DrawingParticipant } from "@/domains/drawing/types";

/** Posisi satu peserta setelah diundi. */
export type Assignment = { matchNumber: number; laneNumber: number };

/**
 * Peta entryId -> posisi (Match n, Lane m). Dipanggil dari DraftDrawing dan LockedDrawing.
 * `settledCount` membatasi hanya slot yang sudah mengendap (urutan baca) agar chip tidak
 * membocorkan hasil sebelum animasi selesai. Untuk drawing terkunci beri `Infinity`.
 */
export function buildAssignments(
  matches: readonly DrawingMatch[],
  settledCount: number,
): Map<string, Assignment> {
  const result = new Map<string, Assignment>();
  let index = 0;
  for (const match of matches) {
    for (const lane of match.lanes) {
      if (index < settledCount)
        result.set(lane.entryId, {
          matchNumber: match.number,
          laneNumber: lane.laneNumber,
        });
      index += 1;
    }
  }
  return result;
}

/**
 * Panel "Participants": jumlah, kotak cari, dan daftar semua peserta yang berhak (pet + bib + pemilik).
 * Setelah diundi tiap baris punya chip "Match n - Lane m". Hover pada baris menyorot slot-nya
 * (lewat `activeId`/`onActive`). Di bawah xl panel bisa dilipat; di xl selalu terbuka.
 */
export const DrawingParticipantsPanel = memo(function DrawingParticipantsPanel({
  participants,
  assignments,
  activeId,
  onActive,
}: {
  participants: readonly DrawingParticipant[];
  assignments: ReadonlyMap<string, Assignment>;
  activeId: string | null;
  onActive: (entryId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? participants.filter((p) =>
        `${p.petName} ${p.ownerName} ${p.bibNumber}`
          .toLowerCase()
          .includes(needle),
      )
    : participants;

  return (
    <section
      aria-label="Participants"
      className="border-border bg-card grid content-start gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">
          Participants{" "}
          <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs font-semibold">
            {participants.length}
          </span>
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="participants-body"
          onClick={() => setOpen((value) => !value)}
          className="text-primary-dark min-h-11 rounded-lg px-3 text-sm font-semibold xl:hidden"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      <div
        id="participants-body"
        className={cn("grid gap-3", !open && "max-xl:hidden")}
      >
        <input
          type="search"
          aria-label="Search participants"
          placeholder="Search pet, owner or bib"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="border-border bg-background min-h-11 w-full rounded-xl border px-3 text-sm"
        />
        {visible.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No participant to show.
          </p>
        ) : (
          <ul className="grid max-h-96 gap-1 overflow-y-auto xl:max-h-[calc(100vh-14rem)]">
            {visible.map((p) => {
              const place = assignments.get(p.entryId);
              return (
                <li
                  key={p.entryId}
                  onMouseEnter={() => onActive(p.entryId)}
                  onMouseLeave={() => onActive(null)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors motion-reduce:transition-none",
                    activeId === p.entryId && "bg-primary-soft",
                  )}
                >
                  <span className="grid min-w-0">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold wrap-break-word">
                        {p.petName}
                      </span>
                      {p.bibNumber && (
                        <span className="text-muted-foreground font-mono text-xs">
                          {p.bibNumber}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs wrap-break-word">
                      {p.ownerName}
                    </span>
                  </span>
                  {place && (
                    <span className="bg-primary-soft text-primary-dark shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                      Match {place.matchNumber} - Lane {place.laneNumber}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
});
