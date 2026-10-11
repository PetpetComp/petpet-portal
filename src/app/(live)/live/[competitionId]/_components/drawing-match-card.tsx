import { cn } from "@/lib/utils";
import type { DrawingLane, DrawingMatch } from "@/domains/drawing/types";

/** Label status match yang ditampilkan di kartu; SCHEDULED tidak diberi label. */
const MATCH_STATUS_NOTE: Record<DrawingMatch["status"], string | null> = {
  SCHEDULED: null,
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/** Isi satu baris lane: nomor lane (mono), nama hewan + bib (mono), dan nama pemilik. */
function LaneContent({ lane }: { lane: DrawingLane }) {
  return (
    <>
      <span className="text-muted-foreground w-5 shrink-0 font-mono text-sm">
        {lane.laneNumber}
      </span>
      <span className="grid min-w-0 text-left">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="font-semibold wrap-break-word">{lane.petName}</span>
          {lane.bibNumber && (
            <span className="text-muted-foreground font-mono text-xs">
              {lane.bibNumber}
            </span>
          )}
        </span>
        <span className="text-muted-foreground text-xs wrap-break-word">
          {lane.ownerName}
        </span>
      </span>
    </>
  );
}

/**
 * Kartu satu match (Match N + baris lane). Dipakai layar Drawing untuk draf (hanya baca)
 * dan drawing terkunci. Bila `swappable`, tiap baris menjadi tombol (tinggi min 44px) yang
 * memanggil `onPick(entryId)`; baris yang dipilih diberi `aria-pressed`.
 * Match yang sudah berjalan tidak bisa dipilih (tombol mati) dan diberi label statusnya.
 */
export function DrawingMatchCard({
  match,
  swappable,
  selectedIds,
  busy,
  onPick,
}: {
  match: DrawingMatch;
  swappable: boolean;
  selectedIds: readonly string[];
  busy: boolean;
  onPick: (entryId: string) => void;
}) {
  const note = MATCH_STATUS_NOTE[match.status];
  const canPick = swappable && match.status === "SCHEDULED";
  return (
    <section
      aria-label={`Match ${match.number}`}
      className="border-border bg-card grid content-start gap-2 rounded-2xl border p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-race font-bold">Match {match.number}</h3>
        {note && (
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            {note}
          </span>
        )}
      </div>
      <ul className="grid gap-1">
        {match.lanes.map((lane) => {
          const selected = selectedIds.includes(lane.entryId);
          return (
            <li key={lane.entryId}>
              {canPick ? (
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Lane ${lane.laneNumber}, ${lane.petName}`}
                  disabled={busy}
                  onClick={() => onPick(lane.entryId)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-2 py-1 text-sm transition-colors motion-reduce:transition-none",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "hover:bg-muted border-transparent",
                    "focus-visible:outline-ring focus-visible:outline-2 disabled:opacity-60",
                  )}
                >
                  <LaneContent lane={lane} />
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1 text-sm">
                  <LaneContent lane={lane} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
