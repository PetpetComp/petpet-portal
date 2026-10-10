import {
  eventPhaseLabel,
  type Event,
  type EventPhase,
  type EventStatus,
} from "@/domains/events/types";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap";

/** Gaya per fase (token DS-Foundations). Label teks selalu ikut, warna bukan satu-satunya penanda. */
const PHASE_STYLE: Record<EventPhase, string> = {
  EVENT_DAY: "bg-event-day text-white",
  UPCOMING: "bg-upcoming-soft text-upcoming",
  DRAFT: "border border-dashed border-lilac-300 text-primary-dark",
  FINISHED: "bg-primary-soft text-primary-dark",
  CANCELLED: "bg-danger-soft text-danger-ink",
};

/** Bila fase belum dikirim backend, gaya diambil dari status. Terbit tanpa fase memakai gaya Finished. */
const STATUS_STYLE: Record<EventStatus, string> = {
  DRAFT: PHASE_STYLE.DRAFT,
  PUBLISHED: PHASE_STYLE.FINISHED,
  CANCELLED: PHASE_STYLE.CANCELLED,
};

/**
 * Badge status event: Event day / Upcoming / Draft / Finished / Cancelled.
 * Dipanggil dari list event, header event, dan pratinjau wizard.
 * Label dari `eventPhaseLabel`; titik putih hanya untuk Event day.
 */
export function EventPhaseBadge({
  event,
}: {
  event: Pick<Event, "phase" | "status">;
}) {
  const style = event.phase
    ? PHASE_STYLE[event.phase]
    : STATUS_STYLE[event.status];
  return (
    <span className={cn(BASE, style)}>
      {event.phase === "EVENT_DAY" && (
        <span aria-hidden className="size-1.5 rounded-full bg-white" />
      )}
      {eventPhaseLabel(event)}
    </span>
  );
}
