import { RESULT_STATUS_LABEL, type ResultRow } from "./types";

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
 * Isi kolom waktu satu baris: waktu bila FINISHED, selain itu teks status (DNF, DQ, DNS).
 * Dipanggil dari podium, tabel, dan export CSV supaya ketiganya selalu sama.
 */
export function timeLabel(
  row: Pick<ResultRow, "status" | "finishTimeMs">,
): string {
  if (row.status !== "FINISHED") return RESULT_STATUS_LABEL[row.status];
  return formatFinishTime(row.finishTimeMs);
}

/**
 * Baris untuk `exportCsv`. Kunci kolom menjadi header file.
 * Dipanggil dari tombol Export di tab Results.
 */
export function resultsCsvRows(
  rows: ResultRow[],
): Record<string, string | number>[] {
  return rows.map((row) => ({
    Rank: row.rank,
    Pet: row.petName,
    Bib: row.bibNumber,
    Owner: row.ownerName,
    Time: timeLabel(row),
    Status: RESULT_STATUS_LABEL[row.status],
  }));
}
