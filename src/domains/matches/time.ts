import { formatFinishTime } from "@/domains/results/format";

/**
 * Logika waktu murni untuk timer resmi Run Match: format, hitung mundur, waktu berjalan, dan
 * cut-off. Semua fungsi menerima jam (`Clock`) sebagai argumen supaya bisa diuji tanpa menunggu.
 * Di layar jam yang dipakai adalah `performanceClock` (monotonik, tidak terpengaruh jam sistem),
 * BUKAN `setInterval` yang menghitung tick: tick hanya memicu gambar ulang, nilainya dibaca dari jam.
 */

/** Jam: mengembalikan milidetik (boleh pecahan) sejak titik acak yang tetap. */
export type Clock = () => number;

/** Jam asli untuk layar: `performance.now()`. */
export const performanceClock: Clock = () => performance.now();

/**
 * Waktu timer "MM:SS.mmm" (38412 -> "00:38.412"; 0 -> "00:00.000"). Lebih dari satu jam menjadi
 * "H:MM:SS.mmm". Negatif (jam mundur) dianggap 0, nilai bukan angka juga 0 supaya timer tidak
 * pernah menampilkan "NaN". Dipanggil dari timer besar dan kartu lane.
 */
export function formatTimer(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return formatFinishTime(0);
  return formatFinishTime(ms);
}

/**
 * Cut-off "MM:SS" (90000 -> "01:30"), tanpa milidetik karena dibulatkan ke detik terdekat ke bawah.
 * Lebih dari satu jam: "H:MM:SS". Dipanggil dari header Live ("Cut-off 01:30").
 */
export function formatCutoff(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Waktu berjalan (ms, bulat) sejak `startMark` (nilai `clock()` saat start ditekan).
 * Tidak pernah negatif. Dipanggil tiap frame oleh timer dan saat Finish ditekan: nilai inilah
 * yang dikirim sebagai `captured_time_ms` apa adanya (keputusan 2A, server tidak menghitung ulang).
 */
export function elapsedMs(
  startMark: number,
  clock: Clock = performanceClock,
): number {
  return Math.max(0, Math.round(clock() - startMark));
}

/** Keadaan hitung mundur pada satu saat. */
export type CountdownState = {
  /** Angka yang ditampilkan (3, 2, 1). 0 bila sudah selesai. */
  secondsLeft: number;
  /** True bila hitung mundur sudah habis (match boleh mulai). */
  done: boolean;
};

/**
 * Keadaan hitung mundur `totalSeconds` detik yang dimulai pada `countdownStartMark`.
 * Angka tampil dibulatkan ke atas: 3.0 detik tersisa tampil "3", 0.2 detik tersisa tampil "1",
 * lalu "0" dan `done`. `totalSeconds` 0 (countdown mati) langsung `done`.
 */
export function countdownState(
  countdownStartMark: number,
  totalSeconds: number,
  clock: Clock = performanceClock,
): CountdownState {
  const remainingMs = totalSeconds * 1000 - (clock() - countdownStartMark);
  if (totalSeconds <= 0 || remainingMs <= 0)
    return { secondsLeft: 0, done: true };
  return { secondsLeft: Math.ceil(remainingMs / 1000), done: false };
}

/**
 * True bila waktu berjalan sudah mencapai cut-off. `cutoffMs` null atau 0 berarti tidak ada
 * cut-off. Dipanggil dari timer untuk memicu Stop dengan alasan CUTOFF.
 */
export function isCutoffReached(
  elapsed: number,
  cutoffMs: number | null,
): boolean {
  if (cutoffMs === null || cutoffMs <= 0) return false;
  return elapsed >= cutoffMs;
}

/** Sisa waktu sampai cut-off (ms, tidak negatif); null bila tidak ada cut-off. */
export function cutoffRemainingMs(
  elapsed: number,
  cutoffMs: number | null,
): number | null {
  if (cutoffMs === null || cutoffMs <= 0) return null;
  return Math.max(0, cutoffMs - elapsed);
}

/**
 * Nomor `finish_order` berikutnya untuk satu sesi: yang terbesar (termasuk yang VOID) ditambah 1.
 * Backend menolak `finish_order` yang sudah pernah dipakai di sesi itu, juga oleh capture VOID,
 * jadi setelah undo nomornya melompat (1, 3, ...); itu normal.
 */
export function nextFinishOrder(
  captures: readonly { finishOrder: number }[],
): number {
  return captures.reduce((max, c) => Math.max(max, c.finishOrder), 0) + 1;
}

/** Nomor sesi berikutnya untuk satu match (backend meminta `session_number` unik per match). */
export function nextSessionNumber(
  sessions: readonly { number: number }[],
): number {
  return sessions.reduce((max, s) => Math.max(max, s.number), 0) + 1;
}
