import { cutoffRemainingMs, isCutoffReached } from "@/domains/matches/time";

/**
 * Aturan cut-off Time trial (batas waktu SATU attempt). Fungsi waktunya dipakai ulang dari
 * `@/domains/matches/time` (jangan menggandakan). Di sini hanya keputusan yang spesifik attempt.
 *
 * Aturan: attempt yang waktunya mencapai cut-off (`elapsed >= cutoff`) dihentikan otomatis dengan
 * status TIMEOUT (via `PATCH /attempts/{uuid}/status`). Ia tidak punya waktu sah tetapi MEMAKAI
 * jatah. Timer result FINISHED dengan waktu >= cut-off ditolak server (422).
 */

/** Status attempt untuk waktu yang sudah mencapai cut-off. */
export const TIMEOUT_STATUS = "TIMEOUT" as const;

/**
 * True bila timer layar harus menghentikan attempt sebagai TIMEOUT sekarang.
 * Dipanggil dari timer layar tiap frame dan dari mock saat memeriksa timer result.
 * `cutoffMs` null atau 0 = tanpa cut-off.
 */
export function shouldTimeout(
  elapsedMs: number,
  cutoffMs: number | null,
): boolean {
  return isCutoffReached(elapsedMs, cutoffMs);
}

/** Sisa waktu sampai cut-off (ms); null bila tanpa cut-off. Dipakai ulang dari matches/time. */
export const remainingUntilCutoff = cutoffRemainingMs;
