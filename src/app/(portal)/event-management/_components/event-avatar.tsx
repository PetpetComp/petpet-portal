import { eventInitials } from "@/domains/events/schema";
import type { EventPhase } from "@/domains/events/types";
import { cn } from "@/lib/utils";

/** Ukuran kotak: "sm" untuk baris tabel dan pratinjau, "lg" untuk header event. */
type AvatarSize = "sm" | "lg";

const SIZE: Record<AvatarSize, string> = {
  sm: "size-10 rounded-[10px] text-[13px]",
  lg: "size-15 rounded-2xl font-display text-[19px]",
};

/** Warna kotak mengikuti fase: Event day oranye, Finished redup, lainnya lilac. */
const TONE: Partial<Record<EventPhase, string>> = {
  EVENT_DAY: "bg-event-day-soft text-event-day-ink",
  FINISHED: "bg-muted text-primary-dark",
};

/**
 * Kotak inisial event (contoh "SPR") yang menggantikan foto bila event belum punya foto.
 * Dipanggil dari list event, header event, dan pratinjau wizard.
 * `phase` null (backend belum mengirim fase) memakai warna lilac biasa.
 */
export function EventAvatar({
  name,
  phase,
  size = "sm",
}: {
  name: string;
  phase: EventPhase | null;
  size?: AvatarSize;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-extrabold",
        SIZE[size],
        (phase && TONE[phase]) ?? "bg-primary-soft text-primary-dark",
      )}
    >
      {eventInitials(name)}
    </span>
  );
}
