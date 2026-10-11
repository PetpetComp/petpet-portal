import type { CompetitionStatus } from "@/domains/competitions/types";
import { COMPETITION_STATUS_LABEL } from "@/domains/competitions/types";
import type { CompetitionDrawing } from "@/domains/drawing/types";

/**
 * Logika murni baris progres kartu Live ("Match 2 of 9 - 5 lanes"), tanpa React.
 * Dipanggil dari `useLiveProgress` (queries.ts), dites di `live-progress.test.ts`.
 */

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : one + "s"}`;

/**
 * Menyusun baris progres satu kompetisi.
 * Input: status kompetisi, apakah tipenya Race (hanya Race punya drawing), drawing (null bila
 * belum dimuat atau gagal), dan jumlah lane dari rule aktif (null bila belum ada).
 * Output: potongan teks digabung " - ". Tanpa data sama sekali, hanya label status.
 * Kenapa: drawing belum tentu boleh dibaca akun ini, jadi layar tetap harus punya teks cadangan.
 */
export function liveProgressLine(input: {
  status: CompetitionStatus;
  isRace: boolean;
  drawing: Pick<CompetitionDrawing, "locked" | "matches" | "lanes"> | null;
  laneTotal: number | null;
}): string {
  const { status, isRace, drawing, laneTotal } = input;
  if (!isRace) return COMPETITION_STATUS_LABEL[status];

  const parts: string[] = [];
  if (drawing?.locked && drawing.matches.length > 0) {
    const current = drawing.matches.find((m) => m.status !== "COMPLETED");
    parts.push(
      current
        ? `Match ${current.number} of ${drawing.matches.length}`
        : `All ${plural(drawing.matches.length, "match")} done`,
    );
  } else if (drawing && !drawing.locked) {
    parts.push("Drawing not done yet");
  }
  const lanes = drawing?.lanes ?? laneTotal;
  if (lanes) parts.push(plural(lanes, "lane"));

  return parts.length > 0
    ? parts.join(" - ")
    : COMPETITION_STATUS_LABEL[status];
}
