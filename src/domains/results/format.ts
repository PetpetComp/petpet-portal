import {
  RESULT_STATUS_LABEL,
  type ResultRow,
  type ResultVariant,
} from "./types";

const pad = (value: number, width: number) =>
  String(value).padStart(width, "0");

/**
 * Waktu finish dalam milidetik menjadi "MM:SS.mmm" (38412 -> "00:38.412").
 * Bila lebih dari satu jam: "H:MM:SS.mmm". Nilai bukan angka atau negatif menjadi "-".
 * Dipakai podium, tabel, dan CSV.
 */
export function formatFinishTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "-";
  const total = Math.round(ms);
  const millis = total % 1000;
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / 60000) % 60;
  const hours = Math.floor(total / 3600000);
  const tail = `${pad(seconds, 2)}.${pad(millis, 3)}`;
  return hours > 0
    ? `${hours}:${pad(minutes, 2)}:${tail}`
    : `${pad(minutes, 2)}:${tail}`;
}

/**
 * Isi kolom nilai satu baris. Race dan Time trial: waktu bila FINISHED, selain itu teks status
 * (DNF, DQ, DNS). Contest: nilai juri 0-100 bila sudah dinilai, selain itu "Not scored".
 * Dipanggil dari podium, tabel, dan export CSV supaya ketiganya selalu sama.
 */
export function timeLabel(
  row: Pick<ResultRow, "status" | "finishTimeMs"> &
    Partial<Pick<ResultRow, "score">>,
  variant: ResultVariant = "RACE",
): string {
  if (variant === "CONTEST") {
    return row.score === null || row.score === undefined
      ? "Not scored"
      : row.score.toFixed(1);
  }
  if (row.status !== "FINISHED") return RESULT_STATUS_LABEL[row.status];
  return formatFinishTime(row.finishTimeMs);
}

/** Judul kolom nilai per jenis klasemen. */
export function valueHeading(variant: ResultVariant): string {
  return variant === "CONTEST" ? "Score" : "Time";
}

/**
 * Keterangan kecil di bawah nilai: jumlah attempt (Time trial) atau jumlah juri (Contest).
 * String kosong untuk Race atau bila datanya tidak ada.
 */
export function detailLabel(row: ResultRow, variant: ResultVariant): string {
  if (variant === "TIME_TRIAL" && row.attemptsUsed)
    return `${row.attemptsUsed} ${row.attemptsUsed === 1 ? "attempt" : "attempts"}`;
  if (variant === "CONTEST" && row.judgesScored)
    return `${row.judgesScored} ${row.judgesScored === 1 ? "judge" : "judges"}`;
  return "";
}

/**
 * Baris untuk `exportCsv`. Kunci kolom menjadi header file.
 * Dipanggil dari tombol Export di tab Results.
 */
export function resultsCsvRows(
  rows: ResultRow[],
  variant: ResultVariant = "RACE",
): Record<string, string | number>[] {
  return rows.map((row) => ({
    Rank: row.rank,
    Pet: row.petName,
    Bib: row.bibNumber,
    Owner: row.ownerName,
    [valueHeading(variant)]: timeLabel(row, variant),
    Status: RESULT_STATUS_LABEL[row.status],
    ...(variant === "TIME_TRIAL" ? { Attempts: row.attemptsUsed ?? "" } : {}),
    ...(variant === "CONTEST" ? { Judges: row.judgesScored ?? "" } : {}),
  }));
}
