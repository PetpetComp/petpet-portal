"use client";
import { useBestTimes } from "@/domains/timetrial/queries";
import type { QueueParticipant } from "@/domains/timetrial/types";
import { formatTimer } from "@/domains/matches/time";

/** Judul kecil huruf kapital di kolom kanan ("BEST TIMES SO FAR", "UP NEXT"). */
function PanelTitle({ children }: { children: string }) {
  return (
    <h2 className="text-muted-foreground text-xs font-bold tracking-widest">
      {children}
    </h2>
  );
}

/**
 * Panel "BEST TIMES SO FAR": tiga peserta berperingkat teratas (rank, pet + bib, waktu mono).
 * Dipanggil dari kolom kanan layar Run Time trial. Data dari `useBestTimes`, yang memakai cache
 * antrean yang sama dengan layar (satu permintaan); peringkat dihitung server.
 */
export function BestTimesPanel({ competitionId }: { competitionId: string }) {
  const best = useBestTimes(competitionId);
  const rows = best.data ?? [];
  return (
    <section aria-label="Best times so far" className="grid gap-2.5">
      <PanelTitle>BEST TIMES SO FAR</PanelTitle>
      {rows.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-3.5 py-3 text-sm">
          No times yet
        </p>
      ) : (
        <ol className="grid gap-2.5">
          {rows.map((row) => (
            <li
              key={row.entryId}
              className="bg-card flex items-center gap-3 rounded-2xl px-3.5 py-3"
            >
              <b className="text-time-trial w-5">{row.rank}</b>
              <span className="min-w-0 grow wrap-break-word">
                {row.petName}
                {row.bibNumber && (
                  <span className="text-muted-foreground ml-1.5 font-mono text-xs">
                    {row.bibNumber}
                  </span>
                )}
              </span>
              <b className="font-mono tabular-nums">
                {formatTimer(row.timeMs)}
              </b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Panel "UP NEXT": peserta berikutnya (pet + bib dan pemilik), atau "Nobody left". Dipanggil dari
 * kolom kanan layar Run Time trial; `next` dari `upNext(...)` di domain.
 */
export function UpNextPanel({ next }: { next: QueueParticipant | null }) {
  return (
    <section aria-label="Up next" className="grid gap-2.5 pt-3">
      <PanelTitle>UP NEXT</PanelTitle>
      <p className="border-border text-muted-foreground rounded-2xl border border-dashed px-3.5 py-3 wrap-break-word">
        {next ? (
          <>
            <span className="text-foreground">
              {next.petName}
              {next.bibNumber && ` ${next.bibNumber}`}
            </span>{" "}
            - {next.ownerName}
          </>
        ) : (
          "Nobody left"
        )}
      </p>
    </section>
  );
}
