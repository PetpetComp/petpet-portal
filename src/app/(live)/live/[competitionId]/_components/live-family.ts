import { JUDGING_TYPE_CODES } from "@/domains/judging/constants";
import { TIMETRIAL_TYPE_CODE } from "@/domains/timetrial/constants";

/**
 * Tiga keluarga kompetisi di Live Mode: Race (Drawing, Matches, Results), Time trial (Running
 * order, Run, Results), dan Contest (Judging, Results).
 */
export type LiveVariant = "race" | "timetrial" | "contest";

/** True bila kode tipe kompetisi adalah Contest yang dinilai juri (BEAUTY, BEST_IN_SHOW). */
export function isJudgingTypeCode(code: string | undefined): boolean {
  return JUDGING_TYPE_CODES.some((c) => c === code);
}

/**
 * Keluarga Live Mode dari kode tipe kompetisi. Dipanggil dari live-shell (tab, subjudul) dan
 * halaman masuk `/live/[id]` (tujuan redirect). Kode belum dikenal atau belum dimuat -> "race".
 */
export function liveVariantOf(code: string | undefined): LiveVariant {
  if (code === TIMETRIAL_TYPE_CODE) return "timetrial";
  if (isJudgingTypeCode(code)) return "contest";
  return "race";
}
