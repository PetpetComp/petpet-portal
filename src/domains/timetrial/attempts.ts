import {
  ACTIVE_ATTEMPT_STATUSES,
  COUNTED_ATTEMPT_STATUSES,
  type ApiAttempt,
  type Attempt,
  type AttemptStatus,
} from "./types";

/**
 * Logika murni attempt: mana yang dihitung ke jatah, nomor berikutnya, dan waktu terbaik.
 * Tidak menyentuh API, jam, atau React. Dipakai dua tempat dengan fungsi yang SAMA: layar
 * dan mock (mock-timetrial.ts menghitung `attempts_counted`, `best_time_ms`, dan `actions`
 * dengan fungsi ini). Backend asli sebaiknya memakai aturan yang sama.
 */

/**
 * Fakta satu attempt yang dibutuhkan aturan. Bentuk netral supaya bisa dibuat dari attempt API
 * (`attemptFactsFromApi`, dipakai mock) maupun attempt layar (`attemptFacts`).
 */
export type AttemptFacts = {
  /** `attempt_number` (nomor fisik, naik terus). */
  number: number;
  status: AttemptStatus;
  /** `final_duration_ms` timer result (raw + penalti); null bila belum ada hasil. */
  finalDurationMs: number | null;
  /** Kapan attempt berhenti (ISO); dipakai memutus waktu sama. */
  stoppedAt: string | null;
};

/** Fakta dari attempt API. Dipanggil dari mock. */
export function attemptFactsFromApi(row: ApiAttempt): AttemptFacts {
  return {
    number: row.attempt_number,
    status: row.status,
    finalDurationMs: row.timer_result?.final_duration_ms ?? null,
    stoppedAt: row.stopped_at,
  };
}

/** Fakta dari attempt layar. Dipanggil dari layar dan tes. */
export function attemptFacts(attempt: Attempt): AttemptFacts {
  return {
    number: attempt.number,
    status: attempt.status,
    finalDurationMs: attempt.result?.finalDurationMs ?? null,
    stoppedAt: attempt.stoppedAt,
  };
}

/**
 * True bila status memakai jatah `attempt_limit` (keputusan 3A): FINISHED, TIMEOUT, DNF, DSQ.
 * FALSE_START dan RETRY tidak, WAITING dan RUNNING belum.
 */
export function isCountedStatus(status: AttemptStatus): boolean {
  return (COUNTED_ATTEMPT_STATUSES as readonly string[]).includes(status);
}

/** True bila attempt masih berjalan atau menunggu mulai (WAITING atau RUNNING). */
export function isActiveStatus(status: AttemptStatus): boolean {
  return (ACTIVE_ATTEMPT_STATUSES as readonly string[]).includes(status);
}

/** Jumlah attempt yang memakai jatah. Contoh: [FALSE_START, FINISHED, TIMEOUT] -> 2. */
export function countedAttempts(
  attempts: readonly Pick<AttemptFacts, "status">[],
): number {
  return attempts.filter((a) => isCountedStatus(a.status)).length;
}

/** Sisa jatah, tidak pernah negatif. Contoh: limit 3, terhitung 1 -> 2. */
export function attemptsRemaining(limit: number, counted: number): number {
  return Math.max(0, limit - counted);
}

/**
 * Nomor `attempt_number` berikutnya: yang terbesar (termasuk RETRY dan FALSE_START) ditambah 1.
 * Backend menolak nomor yang sudah dipakai peserta di ronde itu, jadi setelah Retry nomornya
 * melompat (1, 2, 3 ...) walau jatah belum habis; itu normal (keputusan 3A).
 */
export function nextAttemptNumber(
  attempts: readonly Pick<AttemptFacts, "number">[],
): number {
  return attempts.reduce((max, a) => Math.max(max, a.number), 0) + 1;
}

/**
 * Nomor yang DITAMPILKAN di layar untuk attempt berikutnya ("Start attempt 2"): terhitung + 1,
 * BUKAN `attempt_number` fisik (yang melompat setelah Retry).
 */
export function nextAttemptLabel(counted: number): number {
  return counted + 1;
}

/** Attempt aktif (WAITING atau RUNNING); null bila tidak ada. Dipanggil dari layar dan mock. */
export function activeAttempt<T extends Pick<AttemptFacts, "status">>(
  attempts: readonly T[],
): T | null {
  return attempts.find((a) => isActiveStatus(a.status)) ?? null;
}

/** Attempt terakhir yang dihitung (nomor tertinggi); target Undo. Null bila belum ada. */
export function latestCountedAttempt<
  T extends Pick<AttemptFacts, "status" | "number">,
>(attempts: readonly T[]): T | null {
  const counted = attempts.filter((a) => isCountedStatus(a.status));
  if (counted.length === 0) return null;
  return counted.reduce((last, a) => (a.number > last.number ? a : last));
}

/**
 * Waktu sah satu attempt: `final_duration_ms` bila statusnya FINISHED dan hasilnya sudah
 * tercatat; selain itu null (TIMEOUT, DNF, DSQ, RETRY, FALSE_START tidak punya waktu sah, dan
 * attempt yang sudah di-stop tetapi hasilnya belum tersimpan juga belum).
 */
export function validTimeOf(
  attempt: Pick<AttemptFacts, "status" | "finalDurationMs">,
): number | null {
  if (attempt.status !== "FINISHED") return null;
  return attempt.finalDurationMs;
}

/** Attempt terbaik seorang peserta. */
export type BestAttempt = {
  number: number;
  timeMs: number;
  stoppedAt: string | null;
};

/** True bila `a` lebih baik dari `b`: waktu lebih kecil, lalu lebih dulu tercapai, lalu nomor kecil. */
function isBetterAttempt(a: BestAttempt, b: BestAttempt): boolean {
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs;
  if (a.stoppedAt !== b.stoppedAt) {
    if (a.stoppedAt === null) return false;
    if (b.stoppedAt === null) return true;
    return a.stoppedAt < b.stoppedAt;
  }
  return a.number < b.number;
}

/**
 * Attempt terbaik = waktu sah tercepat. Waktu sama: yang berhenti lebih dulu (`stoppedAt` lebih
 * awal; null dianggap paling akhir), lalu nomor attempt lebih kecil. Null bila tidak ada waktu sah.
 * Contoh: [FINISHED 41230, FINISHED 38412, TIMEOUT] -> attempt kedua, 38412.
 */
export function bestAttemptOf(
  attempts: readonly AttemptFacts[],
): BestAttempt | null {
  let best: BestAttempt | null = null;
  for (const attempt of attempts) {
    const timeMs = validTimeOf(attempt);
    if (timeMs === null) continue;
    const candidate: BestAttempt = {
      number: attempt.number,
      timeMs,
      stoppedAt: attempt.stoppedAt,
    };
    if (best === null || isBetterAttempt(candidate, best)) best = candidate;
  }
  return best;
}
