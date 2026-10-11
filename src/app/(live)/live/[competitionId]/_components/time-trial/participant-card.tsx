import type { QueueParticipant } from "@/domains/timetrial/types";
import { cn } from "@/lib/utils";
import { attemptCircles, type CircleState } from "./run-helpers";

const CIRCLE_STYLE: Record<CircleState, string> = {
  done: "bg-time-trial text-white",
  current: "border-2 border-time-trial text-time-trial",
  remaining: "border border-border text-muted-foreground",
};

const CIRCLE_LABEL: Record<CircleState, string> = {
  done: "counted",
  current: "next",
  remaining: "not used",
};

/**
 * Kartu peserta yang sedang giliran (desain Live-TimeTrial): nama hewan + bib, pemilik dan morph,
 * dan lingkaran "Attempt" 1..limit. Dipanggil dari layar Run Time trial. Hanya tampilan: jumlah
 * attempt terhitung datang dari server (`attemptsCounted`), jadi false start tidak mengisi lingkaran.
 */
export function ParticipantCard({
  participant,
  attemptLimit,
}: {
  participant: QueueParticipant;
  attemptLimit: number;
}) {
  const circles = attemptCircles(participant.attemptsCounted, attemptLimit);
  const owner = participant.petMorphName
    ? `${participant.ownerName} - ${participant.petMorphName}`
    : participant.ownerName;
  return (
    <section
      aria-label="Current participant"
      className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 md:p-[18px]"
    >
      <div className="grid min-w-0">
        <h2 className="font-display flex min-w-0 flex-wrap items-baseline gap-x-2 text-[28px] leading-9 font-bold">
          <span className="wrap-break-word">{participant.petName}</span>
          {participant.bibNumber && <span>{participant.bibNumber}</span>}
        </h2>
        <p className="text-muted-foreground wrap-break-word">{owner}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground mr-1 text-[13px]">Attempt</span>
        <ol className="flex gap-2" aria-label="Attempts">
          {circles.map((circle) => (
            <li
              key={circle.number}
              aria-label={`Attempt ${circle.number}, ${CIRCLE_LABEL[circle.state]}`}
              data-circle-state={circle.state}
              className={cn(
                "grid size-9 place-items-center rounded-full font-extrabold",
                CIRCLE_STYLE[circle.state],
              )}
            >
              {circle.number}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
