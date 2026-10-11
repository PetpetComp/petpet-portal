import type { ResultMode } from "@/domains/competitions/types";
import {
  kindOfResultMode,
  type CompetitionKind,
} from "@/domains/events/overview";
import { cn } from "@/lib/utils";

/** Warna badge per jenis lomba (token DS-Foundations). Teks jenis selalu ikut, warna bukan satu-satunya penanda. */
const KIND_STYLE: Record<CompetitionKind, string> = {
  race: "bg-warning-soft text-race",
  checkpoint: "bg-warning-soft text-checkpoint",
  time_trial: "bg-time-trial-soft text-time-trial-ink",
  contest: "bg-primary-soft text-contest",
};

/**
 * Pil jenis lomba di header kompetisi ("Race", "Time Trial", ...). Warna dari `result_mode`
 * type-nya, teks dari nama type. Dipanggil dari header dan kartu Overview.
 */
export function TypeBadge({
  resultMode,
  name,
}: {
  resultMode: ResultMode;
  name: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        KIND_STYLE[kindOfResultMode(resultMode)],
      )}
    >
      {name}
    </span>
  );
}
