import { isCountedStatus } from "@/domains/timetrial/attempts";
import type { TimetrialPhase } from "@/domains/timetrial/phase";
import type { Attempt, QueueParticipant } from "@/domains/timetrial/types";
import { formatTimer } from "@/domains/matches/time";
import type { PendingResult } from "./result-queue";

/**
 * Fungsi murni untuk layar Run Time trial (teks dan bentuk data kecil). Tidak menyentuh API, jam,
 * atau React supaya mudah diuji. Dipanggil dari `time-trial-run.tsx` dan `participant-card.tsx`.
 */

export type CircleState = "done" | "current" | "remaining";

/**
 * Lingkaran attempt 1..limit. Terisi (done) = sudah dihitung, garis (current) = attempt berikutnya
 * atau yang sedang berjalan, abu-abu (remaining) = sisa. False start dan Retry tidak mengisi
 * lingkaran karena tidak dihitung (keputusan 3A). Jatah habis: tidak ada lingkaran "current".
 * Contoh: counted 1, limit 3 -> [done, current, remaining].
 */
export function attemptCircles(
  counted: number,
  limit: number,
): { number: number; state: CircleState }[] {
  return Array.from({ length: Math.max(0, limit) }, (_, index) => {
    const number = index + 1;
    const state: CircleState =
      number <= counted
        ? "done"
        : number === counted + 1
          ? "current"
          : "remaining";
    return { number, state };
  });
}

/** Attempt terhitung terakhir (nomor tertinggi) beserta urutannya di antara yang terhitung (1, 2, ...). */
export function lastCountedAttempt(
  attempts: readonly Attempt[],
): { ordinal: number; attempt: Attempt } | null {
  const counted = attempts
    .filter((a) => isCountedStatus(a.status))
    .sort((a, b) => a.number - b.number);
  if (counted.length === 0) return null;
  return { ordinal: counted.length, attempt: counted[counted.length - 1] };
}

/**
 * Teks hasil satu attempt terhitung untuk baris "Cut-off ... attempt 1: 01:12.540".
 * FINISHED dengan waktu tersimpan -> waktunya; TIMEOUT -> "Timeout"; DNF -> "DNF"; DSQ -> "DSQ";
 * FINISHED tanpa waktu tersimpan -> "Not saved".
 */
export function attemptResultText(attempt: Attempt): string {
  switch (attempt.status) {
    case "FINISHED":
      return attempt.result
        ? formatTimer(attempt.result.finalDurationMs)
        : "Not saved";
    case "TIMEOUT":
      return "Timeout";
    case "DNF":
      return "DNF";
    case "DSQ":
      return "DSQ";
    default:
      return "-";
  }
}

/**
 * Catatan peringkat setelah attempt selesai: "New best time 00:38.412 - rank 2" bila attempt
 * terakhir itulah yang terbaik, "Best time 00:38.412 - rank 2" bila yang terbaik attempt lain.
 * Null bila peserta belum punya waktu sah (belum berperingkat). Peringkat dari server (`bestRank`).
 */
export function rankNote(
  participant: Pick<
    QueueParticipant,
    "bestRank" | "bestTimeMs" | "bestAttemptNumber"
  >,
  last: Attempt | null,
): string | null {
  if (participant.bestRank === null || participant.bestTimeMs === null)
    return null;
  const newBest =
    last !== null &&
    last.status === "FINISHED" &&
    last.number === participant.bestAttemptNumber;
  return `${newBest ? "New best time" : "Best time"} ${formatTimer(participant.bestTimeMs)} - rank ${participant.bestRank}`;
}

/** Teks "3-2-1" untuk hitung mundur `seconds` detik; kosong bila hitung mundur mati. */
export function countdownDigits(seconds: number): string {
  return Array.from(
    { length: Math.max(0, seconds) },
    (_, i) => seconds - i,
  ).join("-");
}

/**
 * Teks baris status di bawah timer. `pending` (hasil belum tersimpan di server) didahulukan,
 * lalu `starting` (hitung mundur habis tetapi server belum mengonfirmasi start), lalu fase layar.
 * Dipanggil dari layar Run Time trial.
 */
export function statusText(input: {
  phase: TimetrialPhase;
  starting: boolean;
  pending: PendingResult | null;
  countdownSeconds: number;
  counted: number;
  last: Attempt | null;
}): string {
  const { phase, starting, pending, countdownSeconds, counted, last } = input;
  if (pending) {
    if (pending.status === "sending") return "Saving the time...";
    if (pending.status === "waiting")
      return "Pending - waiting for a connection";
    return "Not saved";
  }
  if (starting) return "Starting...";
  switch (phase) {
    case "COUNTDOWN":
      return "Get ready";
    case "RUNNING":
      return "Running";
    case "RESULT_PENDING":
      return "Time not saved";
    case "BETWEEN_ATTEMPTS":
    case "QUOTA_USED":
      return last?.status === "TIMEOUT"
        ? `Cut-off reached - attempt ${counted} counted`
        : `Attempt ${counted} recorded`;
    default:
      return countdownSeconds > 0
        ? `Ready - countdown ${countdownDigits(countdownSeconds)} is on`
        : "Ready";
  }
}
