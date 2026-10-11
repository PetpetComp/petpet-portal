import { nextAttemptLabel } from "./attempts";
import type { QueueItemActions, QueueParticipant } from "./types";

/**
 * Mesin status fase layar Time trial untuk peserta yang sedang giliran. Fase = apa yang dilihat
 * operator; hitung mundur 3-2-1 hanya ada di klien (attempt WAITING di server selama hitung
 * mundur). Aturan sebenarnya (siapa boleh, data mengizinkan atau tidak) dipegang server lewat
 * `participant.actions`; fungsi di sini hanya menentukan fase dan tombol utama.
 */

export const TIMETRIAL_PHASES = [
  /** Undian belum di-lock: belum ada antrean. */
  "NOT_DRAWN",
  /** Semua peserta sudah selesai (atau antrean kosong). */
  "QUEUE_DONE",
  /** Peserta belum punya attempt terhitung: tombol "Start attempt 1". */
  "IDLE",
  /** Attempt WAITING dan hitung mundur di layar berjalan. */
  "COUNTDOWN",
  /** Attempt WAITING tetapi hitung mundur belum atau tidak berjalan (mis. layar dibuka ulang). */
  "READY",
  /** Attempt RUNNING: timer jalan, Stop aktif. */
  "RUNNING",
  /** Attempt sudah di-stop tetapi waktunya belum tersimpan: harus dicoba lagi (jangan Stop ulang). */
  "RESULT_PENDING",
  /** Ada attempt terhitung dan jatah tersisa: "Start attempt N" atau "Next participant". */
  "BETWEEN_ATTEMPTS",
  /** Jatah habis: hanya "Next participant". */
  "QUOTA_USED",
] as const;
export type TimetrialPhase = (typeof TIMETRIAL_PHASES)[number];

/** Masukan `phaseOf`. */
export type PhaseInput = {
  drawingLocked: boolean;
  /** Semua peserta selesai (`queue.finished`). */
  finished: boolean;
  /** Peserta yang sedang giliran; null bila tidak ada. */
  participant: Pick<
    QueueParticipant,
    "attempts" | "attemptsCounted" | "activeAttempt"
  > | null;
  attemptLimit: number;
  /** Layar sedang menghitung mundur. */
  countdownActive: boolean;
};

/**
 * Attempt yang sudah berstatus FINISHED tetapi belum punya timer result (stop berhasil, simpan
 * hasil gagal). Null bila tidak ada. Dipanggil dari `phaseOf` dan layar (untuk tombol Retry).
 */
export function pendingResultAttempt(
  attempts: QueueParticipant["attempts"],
): QueueParticipant["attempts"][number] | null {
  return (
    attempts.find((a) => a.status === "FINISHED" && a.result === null) ?? null
  );
}

/**
 * Menentukan fase layar. Urutan cek: belum di-lock, antrean selesai, attempt aktif (RUNNING,
 * lalu WAITING: hitung mundur atau siap), hasil tertunda, lalu menurut jumlah attempt terhitung.
 * Dipanggil dari layar Time trial tiap render.
 */
export function phaseOf(input: PhaseInput): TimetrialPhase {
  if (!input.drawingLocked) return "NOT_DRAWN";
  if (input.finished || input.participant === null) return "QUEUE_DONE";
  const { activeAttempt, attempts, attemptsCounted } = input.participant;
  if (activeAttempt?.status === "RUNNING") return "RUNNING";
  if (activeAttempt?.status === "WAITING")
    return input.countdownActive ? "COUNTDOWN" : "READY";
  if (pendingResultAttempt(attempts) !== null) return "RESULT_PENDING";
  if (attemptsCounted === 0) return "IDLE";
  return attemptsCounted >= input.attemptLimit
    ? "QUOTA_USED"
    : "BETWEEN_ATTEMPTS";
}

/** Tombol utama besar di layar (hijau di desain). */
export const PRIMARY_ACTIONS = [
  "START_ATTEMPT",
  "START_NOW",
  "STOP",
  "RETRY_RESULT",
  "NEXT_PARTICIPANT",
] as const;
export type PrimaryAction = (typeof PRIMARY_ACTIONS)[number];

/**
 * Tombol utama untuk satu fase, atau null bila tidak ada yang boleh (ketuk dimatikan): server
 * tetap menentukan lewat `actions`.
 * - IDLE dan BETWEEN_ATTEMPTS: Start attempt (buat attempt, lalu hitung mundur).
 * - READY: mulai sekarang (attempt WAITING tanpa hitung mundur). COUNTDOWN: tidak ada.
 * - RUNNING: Stop. RESULT_PENDING: ulangi simpan hasil. QUOTA_USED: Next participant.
 */
export function primaryActionOf(
  phase: TimetrialPhase,
  actions: QueueItemActions,
): PrimaryAction | null {
  switch (phase) {
    case "IDLE":
    case "BETWEEN_ATTEMPTS":
      return actions.createAttempt ? "START_ATTEMPT" : null;
    case "READY":
      return actions.start ? "START_NOW" : null;
    case "RUNNING":
      return actions.stop ? "STOP" : null;
    case "RESULT_PENDING":
      return "RETRY_RESULT";
    case "QUOTA_USED":
      return actions.nextParticipant ? "NEXT_PARTICIPANT" : null;
    default:
      return null;
  }
}

/**
 * Teks tombol "Start attempt N" untuk peserta ini; N = terhitung + 1 (bukan nomor fisik, lihat
 * `nextAttemptLabel`). Dipanggil dari layar.
 */
export function startAttemptLabel(attemptsCounted: number): string {
  return `Start attempt ${nextAttemptLabel(attemptsCounted)}`;
}
