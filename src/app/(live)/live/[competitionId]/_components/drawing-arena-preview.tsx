import type { DrawingMatch } from "@/domains/drawing/types";
import { cn } from "@/lib/utils";

/** Warna chip per lane (token aplikasi), diulang bila lane lebih banyak dari warna. */
const LANE_TINTS = [
  "bg-primary-soft text-primary-dark",
  "bg-warning-soft text-event-day-ink",
  "bg-success-soft text-done",
  "bg-info-soft text-upcoming",
  "bg-danger-soft text-danger-ink",
  "bg-time-trial-soft text-time-trial-ink",
];

/** Garis finish kotak-kotak, murni CSS (dua warna token, kotak 6px). */
const CHECKERED_STYLE = {
  backgroundImage:
    "conic-gradient(var(--color-foreground) 25%, var(--color-card) 0 50%, var(--color-foreground) 0 75%, var(--color-card) 0)",
  backgroundSize: "12px 12px",
};

/** Inisial dari nama hewan: huruf pertama dua kata pertama, huruf besar. Contoh "Puffy Dodo" -> "PD". */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

/**
 * Kartu "Arena preview": diagram lintasan CSS untuk satu match (satu jalur per lane, nomor lane
 * di garis start, garis finish kotak-kotak di kanan, chip bundar berinisial + nama hewan di start).
 * Dipanggil dari live-drawing.tsx (draf dan terkunci). `selectedNumber` = match yang ditampilkan; tab Match memilih
 * match juga di layar sentuh (hover/fokus/klik kartu match memilih lewat parent).
 * `laneCount` = jumlah lane per match dari rule; lane tanpa hewan tampil sebagai jalur kosong.
 * `revealing` = animasi shuffle jalan: jalur menampilkan placeholder berdenyut, bukan hasil.
 * Animasi hanya `motion-safe`, jadi prefers-reduced-motion tidak menggerakkan apa pun.
 */
export function DrawingArenaPreview({
  matches,
  selectedNumber,
  onSelect,
  laneCount,
  revealing,
  pending = false,
}: {
  matches: readonly DrawingMatch[];
  selectedNumber: number;
  onSelect: (matchNumber: number) => void;
  laneCount: number;
  revealing: boolean;
  /** Belum diundi: jalur kosong bergaris putus dengan teks "Waiting for the draw", tanpa nama dan tanpa denyut. */
  pending?: boolean;
}) {
  const match = matches.find((m) => m.number === selectedNumber) ?? matches[0];
  if (!match) return null;
  const total = Math.max(laneCount, ...match.lanes.map((l) => l.laneNumber));
  const laneNumbers = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <section
      aria-label="Arena preview"
      aria-busy={revealing}
      className="border-border bg-card grid min-w-0 content-start gap-3 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Arena preview</h2>
        <div
          role="group"
          aria-label="Select match to preview"
          className="flex flex-wrap gap-1.5"
        >
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.number === match.number}
              onClick={() => onSelect(m.number)}
              className={cn(
                "min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold transition-colors motion-reduce:transition-none",
                "focus-visible:outline-ring focus-visible:outline-2",
                m.number === match.number
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-primary-dark hover:bg-primary-soft",
              )}
            >
              Match {m.number}
            </button>
          ))}
        </div>
      </div>

      {pending && (
        <p className="text-muted-foreground text-sm">Waiting for the draw</p>
      )}
      <ul aria-label={`Match ${match.number} lanes`} className="grid gap-1.5">
        {laneNumbers.map((laneNumber) => {
          const lane = pending
            ? undefined
            : match.lanes.find((l) => l.laneNumber === laneNumber);
          const tint = LANE_TINTS[(laneNumber - 1) % LANE_TINTS.length];
          return (
            <li
              key={laneNumber}
              data-lane-state={
                pending
                  ? "pending"
                  : revealing
                    ? "spinning"
                    : lane
                      ? "filled"
                      : "empty"
              }
              aria-label={
                pending
                  ? `Lane ${laneNumber}, waiting for the draw`
                  : revealing
                    ? `Lane ${laneNumber}, drawing`
                    : lane
                      ? `Lane ${laneNumber}, ${lane.petName}`
                      : `Lane ${laneNumber}, empty`
              }
              className="flex min-w-0 items-center gap-2"
            >
              <span className="text-primary-dark w-6 shrink-0 text-center font-mono text-base leading-none font-bold">
                {laneNumber}
              </span>
              <span
                className={cn(
                  "relative flex min-h-11 min-w-0 flex-1 items-center overflow-hidden rounded-full border px-1.5",
                  lane || revealing
                    ? "border-border bg-muted"
                    : "border-input border-dashed bg-transparent",
                )}
              >
                {revealing ? (
                  <span
                    aria-hidden
                    className="bg-primary-soft h-8 w-28 rounded-full motion-safe:animate-pulse"
                  />
                ) : lane ? (
                  <span className="flex min-w-0 items-center gap-2 pr-5">
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
                        tint,
                      )}
                    >
                      {initialsOf(lane.petName)}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {lane.petName}
                    </span>
                  </span>
                ) : pending ? null : (
                  <span className="text-muted-foreground pl-2 text-xs">
                    Empty lane
                  </span>
                )}
                <span
                  aria-hidden
                  style={CHECKERED_STYLE}
                  className={cn(
                    "absolute inset-y-0 right-0 w-3",
                    !pending && "motion-safe:animate-pulse",
                  )}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
