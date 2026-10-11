import { cn } from "@/lib/utils";
import type {
  DrawingLane,
  DrawingMatch,
  DrawingParticipant,
} from "@/domains/drawing/types";
import { spinIndex } from "./draw-reveal";

/** Label status match yang ditampilkan di kartu; SCHEDULED tidak diberi label. */
const MATCH_STATUS_NOTE: Record<DrawingMatch["status"], string | null> = {
  SCHEDULED: null,
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/**
 * Data animasi reveal untuk satu kartu. `firstSlot` = indeks slot pertama kartu (urutan baca),
 * `settledCount` = slot dengan indeks lebih kecil sudah mengendap, `frame` = tick untuk nama
 * yang berputar, `pool` = peserta yang namanya ditampilkan saat berputar, `animate` = beri efek
 * "pop" pada slot yang mengendap (hanya setelah ada Shuffle, bukan saat load awal).
 */
export type CardReveal = {
  firstSlot: number;
  settledCount: number;
  frame: number;
  pool: readonly DrawingParticipant[];
  animate: boolean;
};

/** Isi satu baris lane: nomor lane besar (mono), nama hewan + bib (mono), dan nama pemilik. Varian antrean memakai aksen teal. */
function LaneContent({
  lane,
  queue = false,
}: {
  lane: DrawingLane;
  queue?: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "w-8 shrink-0 text-center font-mono text-2xl leading-none font-bold",
          queue ? "text-time-trial" : "text-primary-dark",
        )}
      >
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
 * Kartu satu match (header "Match N" + "k pets", bar warna, baris lane). Dipakai layar Drawing
 * untuk draf dan drawing terkunci. Bila `swappable`, tiap baris menjadi tombol (tinggi min 44px)
 * yang memanggil `onPick(entryId)`; baris yang dipilih diberi `aria-pressed`.
 * Match yang sudah berjalan tidak bisa dipilih dan diberi label statusnya.
 * Opsional: `reveal` (animasi shuffle: slot belum mengendap menampilkan nama berputar dan
 * disembunyikan dari pembaca layar), `flashIds` (sorot sebentar setelah swap), serta
 * `activeId`/`onActive` (sorot dua arah dengan panel Participants), serta
 * `previewSelected`/`onPreview` (hover, fokus, atau klik kartu memilih match di Arena preview).
 * `variant="queue"` (Time trial): kartu SATU antrean berjudul "Running order" dengan aksen teal;
 * nomor lane dibaca sebagai posisi antrean, daftar satu kolom, dan tidak ada pratinjau Arena.
 */
export function DrawingMatchCard({
  match,
  swappable,
  selectedIds,
  busy,
  onPick,
  reveal,
  flashIds = [],
  activeId = null,
  onActive,
  previewSelected = false,
  onPreview,
  pending = false,
  variant = "match",
}: {
  match: DrawingMatch;
  swappable: boolean;
  selectedIds: readonly string[];
  busy: boolean;
  onPick: (entryId: string) => void;
  reveal?: CardReveal;
  flashIds?: readonly string[];
  activeId?: string | null;
  onActive?: (entryId: string | null) => void;
  previewSelected?: boolean;
  onPreview?: (matchNumber: number) => void;
  /** Belum diundi: baris hanya berisi nomor lane dan "?", tanpa nama. */
  pending?: boolean;
  variant?: "match" | "queue";
}) {
  const queue = variant === "queue";
  const title = queue ? "Running order" : `Match ${match.number}`;
  const note = MATCH_STATUS_NOTE[match.status];
  const canPick = swappable && match.status === "SCHEDULED";
  const count = match.lanes.length;
  return (
    <section
      aria-label={title}
      onMouseEnter={() => onPreview?.(match.number)}
      onFocus={() => onPreview?.(match.number)}
      onClick={() => onPreview?.(match.number)}
      className={cn(
        "bg-card @container grid content-start overflow-hidden rounded-2xl border",
        previewSelected ? "border-primary" : "border-border",
      )}
    >
      <div
        className={cn("h-1.5", queue ? "bg-time-trial" : "bg-race")}
        aria-hidden
      />
      <div className="grid content-start gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "text-lg font-bold",
              queue ? "text-time-trial" : "text-race",
            )}
          >
            {title}
          </h3>
          <span className="flex items-center gap-2">
            {note && (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                {note}
              </span>
            )}
            <span className="text-muted-foreground text-xs font-semibold">
              {count} {count === 1 ? "pet" : "pets"}
            </span>
          </span>
        </div>
        <ul className={cn("grid gap-1.5", !queue && "@xl:grid-cols-2")}>
          {match.lanes.map((lane, index) => {
            if (pending)
              return (
                <li key={lane.entryId} data-slot-state="pending">
                  <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1 text-sm">
                    <span
                      className={cn(
                        "w-8 shrink-0 text-center font-mono text-2xl leading-none font-bold",
                        queue ? "text-time-trial" : "text-primary-dark",
                      )}
                    >
                      {lane.laneNumber}
                    </span>
                    <span
                      aria-hidden
                      className="text-muted-foreground text-xl font-semibold"
                    >
                      ?
                    </span>
                  </div>
                </li>
              );
            const slotIndex = reveal ? reveal.firstSlot + index : -1;
            if (reveal && slotIndex >= reveal.settledCount) {
              // Slot masih berputar: nama acak, tersembunyi dari pembaca layar.
              const pool = reveal.pool;
              const shown =
                pool[spinIndex(pool.length, slotIndex, reveal.frame)] ?? lane;
              return (
                <li key={lane.entryId} data-slot-state="spinning">
                  <div
                    aria-hidden
                    className="text-primary-dark flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1 text-sm blur-[0.6px] motion-safe:animate-[draw-glow_280ms_ease-in-out_infinite]"
                  >
                    <LaneContent
                      lane={{ ...shown, laneNumber: lane.laneNumber }}
                      queue={queue}
                    />
                  </div>
                </li>
              );
            }
            const selected = selectedIds.includes(lane.entryId);
            const rowClass = cn(
              reveal?.animate &&
                "motion-safe:animate-[draw-pop_500ms_ease-out]",
              flashIds.includes(lane.entryId) &&
                "motion-safe:animate-[draw-flash_1200ms_ease-out]",
              activeId === lane.entryId && "bg-primary-soft",
            );
            return (
              <li
                key={lane.entryId}
                data-slot-state="settled"
                className="rounded-xl"
              >
                {canPick ? (
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${queue ? "Position" : "Lane"} ${lane.laneNumber}, ${lane.petName}`}
                    disabled={busy}
                    onClick={() => onPick(lane.entryId)}
                    onMouseEnter={() => onActive?.(lane.entryId)}
                    onMouseLeave={() => onActive?.(null)}
                    onFocus={() => onActive?.(lane.entryId)}
                    onBlur={() => onActive?.(null)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2 py-1 text-sm transition-colors motion-reduce:transition-none",
                      selected
                        ? "border-primary bg-primary-soft"
                        : "hover:bg-muted border-transparent",
                      "focus-visible:outline-ring focus-visible:outline-2 disabled:opacity-60",
                      rowClass,
                    )}
                  >
                    <LaneContent lane={lane} queue={queue} />
                  </button>
                ) : (
                  <div
                    onMouseEnter={() => onActive?.(lane.entryId)}
                    onMouseLeave={() => onActive?.(null)}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1 text-sm transition-colors motion-reduce:transition-none",
                      rowClass,
                    )}
                  >
                    <LaneContent lane={lane} queue={queue} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
