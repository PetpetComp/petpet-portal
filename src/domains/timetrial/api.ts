import { apiClient, ApiError } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { ApiResponse } from "@/types/common";
import { newClientRequestId } from "@/domains/matches/api";
import { FINISHED_RESULT_STATUS } from "./constants";
import {
  attemptFromApi,
  fromApi,
  timerResultFromApi,
  type ApiAttempt,
  type ApiCreateAttemptBody,
  type ApiQueue,
  type ApiRecordTimerResultBody,
  type ApiRoundEntry,
  type ApiTimerResult,
  type ApiUpdateAttemptStatusBody,
  type ApiUpdateRoundEntryBody,
  type Attempt,
  type ManualAttemptStatus,
  type Queue,
  type RetryStatus,
  type RoundEntryStatus,
  type TimerResult,
} from "./types";

// Disqualify dan cabut penalti memakai endpoint penalti yang sama dengan Run Match
// (`POST /entries/{uuid}/penalties` unit DISQUALIFICATION, `POST /penalties/{uuid}/revoke`).
export {
  disqualify,
  newClientRequestId,
  revokePenalty,
} from "@/domains/matches/api";

/**
 * Error khusus Stop satu ketukan: attempt BERHASIL di-stop (status FINISHED di server) tetapi
 * waktunya belum tersimpan. Layar harus menawarkan "Retry" yang memanggil `recordTimerResult`
 * dengan nilai di error ini (dan `clientRequestId` yang SAMA), JANGAN mengetuk Stop lagi.
 */
export class RecordTimerResultError extends Error {
  /** Attempt yang sudah di-stop dan menunggu hasilnya. */
  readonly attemptId: string;
  /** Waktu yang dilihat operator, dikirim ulang apa adanya. */
  readonly rawDurationMs: number;
  /** Id idempotensi ketukan ini; wajib dipakai ulang saat retry. */
  readonly clientRequestId: string;
  /** Error asli dari penyimpanan hasil. */
  readonly original: unknown;

  constructor(
    attemptId: string,
    rawDurationMs: number,
    clientRequestId: string,
    original: unknown,
  ) {
    super(
      original instanceof Error
        ? `Attempt stopped but the time was not saved: ${original.message}`
        : "Attempt stopped but the time was not saved.",
    );
    this.name = "RecordTimerResultError";
    this.attemptId = attemptId;
    this.rawDurationMs = rawDurationMs;
    this.clientRequestId = clientRequestId;
    this.original = original;
  }

  /** Status HTTP error asli (0 = jaringan putus), supaya layar bisa membedakan "coba lagi" dari "ditolak". */
  get status(): number | null {
    return this.original instanceof ApiError ? this.original.status : null;
  }
}

/**
 * Antrean satu kompetisi Time trial: peserta berurutan, attempt, waktu terbaik, dan `actions`.
 * MOCK: belum ada di backend (kontrak 14).
 */
export async function getQueue(competitionId: string): Promise<Queue> {
  const response = await apiClient.get<ApiResponse<ApiQueue>>(
    ENDPOINTS.timetrial.queue(competitionId),
  );
  return fromApi(response.data);
}

/** Satu attempt (dengan timer result bila ada). Dipakai untuk sinkron ulang setelah jaringan putus. */
export async function getAttempt(attemptId: string): Promise<Attempt> {
  const response = await apiClient.get<ApiResponse<ApiAttempt>>(
    ENDPOINTS.timetrial.attempt(attemptId),
  );
  return attemptFromApi(response.data);
}

/** Input membuat attempt. */
export type CreateAttemptInput = {
  /** `queue.roundId`. */
  roundId: string;
  entryId: string;
  /** Lihat `nextAttemptNumber` (nomor fisik, bukan label layar). */
  attemptNumber: number;
};

/** Body `POST /rounds/{uuid}/attempts` dari input layar. */
export function createAttemptBody(
  input: CreateAttemptInput,
): ApiCreateAttemptBody {
  return { entry_id: input.entryId, attempt_number: input.attemptNumber };
}

/** Membuat attempt berstatus WAITING (butuh `actions.createAttempt`). Hitung mundur lalu `startAttempt`. */
export async function createAttempt(
  input: CreateAttemptInput,
): Promise<Attempt> {
  const response = await apiClient.post<ApiResponse<ApiAttempt>>(
    ENDPOINTS.timetrial.attempts(input.roundId),
    { ...createAttemptBody(input) },
  );
  return attemptFromApi(response.data);
}

/** Memulai attempt WAITING (butuh `actions.start`). Dipanggil saat hitung mundur di layar habis. */
export async function startAttempt(attemptId: string): Promise<Attempt> {
  const response = await apiClient.post<ApiResponse<ApiAttempt>>(
    ENDPOINTS.timetrial.startAttempt(attemptId),
    {},
  );
  return attemptFromApi(response.data);
}

/** Hanya menghentikan attempt RUNNING (status FINISHED, tanpa waktu). Dipakai `stopAndRecord`. */
export async function stopAttempt(attemptId: string): Promise<Attempt> {
  const response = await apiClient.post<ApiResponse<ApiAttempt>>(
    ENDPOINTS.timetrial.stopAttempt(attemptId),
    {},
  );
  return attemptFromApi(response.data);
}

/** Input menyimpan waktu resmi satu attempt. */
export type RecordTimerResultInput = {
  attemptId: string;
  /** Waktu yang dilihat operator (`elapsedMs`), dikirim apa adanya. */
  rawDurationMs: number;
  /** Penalti waktu (ms); bawaan 0. */
  penaltyMs?: number;
  /** Isi dengan id yang sama saat mengulang ketukan yang sama (retry setelah jaringan putus). */
  clientRequestId?: string;
};

/** Body `POST /attempts/{uuid}/timer-result` dari input layar. */
export function timerResultBody(
  input: RecordTimerResultInput,
): ApiRecordTimerResultBody {
  return {
    raw_duration_ms: input.rawDurationMs,
    penalty_ms: input.penaltyMs ?? 0,
    finish_status: FINISHED_RESULT_STATUS,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
  };
}

/**
 * Menyimpan waktu resmi attempt yang sudah di-stop. Aman diulang dengan `clientRequestId` yang
 * sama: server mengembalikan hasil yang sudah ada alih-alih menolak "sudah tercatat".
 * Waktu >= cut-off ditolak (422); gunakan `timeoutAttempt` untuk itu.
 */
export async function recordTimerResult(
  input: RecordTimerResultInput,
): Promise<TimerResult> {
  const response = await apiClient.post<ApiResponse<ApiTimerResult>>(
    ENDPOINTS.timetrial.timerResult(input.attemptId),
    { ...timerResultBody(input) },
  );
  return timerResultFromApi(response.data);
}

/**
 * Stop SATU ketukan: hentikan attempt lalu simpan waktunya.
 * - Stop gagal: error asli dilempar, tidak ada yang tersimpan. Bila Stop gagal 422 karena sudah
 *   pernah berhasil (respons hilang di jaringan), attempt dibaca ulang; yang sudah FINISHED
 *   dilanjutkan ke penyimpanan waktu.
 * - Stop berhasil tetapi waktu gagal tersimpan: melempar `RecordTimerResultError`; layar
 *   memanggil `recordTimerResult` dengan nilai di error itu untuk mencoba lagi.
 * `clientRequestId` dibuat di sini bila tidak diberikan. Dipanggil dari `useStopAttempt`.
 */
export async function stopAndRecord(
  input: RecordTimerResultInput,
): Promise<TimerResult> {
  const clientRequestId = input.clientRequestId ?? newClientRequestId();
  try {
    await stopAttempt(input.attemptId);
  } catch (cause) {
    const alreadyStopped =
      cause instanceof ApiError &&
      cause.status === 422 &&
      (await getAttempt(input.attemptId)).status === "FINISHED";
    if (!alreadyStopped) throw cause;
  }
  try {
    return await recordTimerResult({ ...input, clientRequestId });
  } catch (cause) {
    throw new RecordTimerResultError(
      input.attemptId,
      input.rawDurationMs,
      clientRequestId,
      cause,
    );
  }
}

/** Body `PATCH /attempts/{uuid}/status`. */
export function attemptStatusBody(
  status: ManualAttemptStatus,
): ApiUpdateAttemptStatusBody {
  return { status };
}

/** Mengubah status manual attempt (TIMEOUT, DNF, RETRY, FALSE_START, DSQ). */
export async function setAttemptStatus(
  attemptId: string,
  status: ManualAttemptStatus,
): Promise<Attempt> {
  const response = await apiClient.patch<ApiResponse<ApiAttempt>>(
    ENDPOINTS.timetrial.attemptStatus(attemptId),
    { ...attemptStatusBody(status) },
  );
  return attemptFromApi(response.data);
}

/** Menghentikan attempt RUNNING karena mencapai cut-off (status TIMEOUT; memakai jatah, tanpa waktu sah). */
export function timeoutAttempt(attemptId: string): Promise<Attempt> {
  return setAttemptStatus(attemptId, "TIMEOUT");
}

/**
 * "Retry": membatalkan attempt aktif (WAITING atau RUNNING) tanpa memakai jatah (keputusan 3A).
 * `reason` FALSE_START (bawaan) atau RETRY. Butuh `actions.retry`.
 */
export function retryAttempt(
  attemptId: string,
  reason: RetryStatus = "FALSE_START",
): Promise<Attempt> {
  return setAttemptStatus(attemptId, reason);
}

/**
 * Undo satu attempt yang sudah selesai (FINISHED, TIMEOUT, DNF, DSQ): status menjadi RETRY.
 * Efek: tidak lagi memakai jatah dan waktunya tidak dihitung ke waktu terbaik (waktu lama tetap
 * tersimpan tetapi diabaikan karena statusnya bukan FINISHED). Attempt ini tidak dijalankan
 * ulang; peserta membuat attempt BARU dengan nomor fisik berikutnya. Butuh `actions.undo`.
 */
export function voidAttempt(attemptId: string): Promise<Attempt> {
  return setAttemptStatus(attemptId, "RETRY");
}

/** Body `PATCH /round-entries/{uuid}`. */
export function roundEntryBody(
  status: RoundEntryStatus,
  reason?: string,
): ApiUpdateRoundEntryBody {
  return { status, ...(reason ? { decision_reason: reason } : {}) };
}

/** Mengubah status satu round entry (`RoundEntryData`). Dipakai tombol-tombol di bawah. */
export async function updateRoundEntry(
  roundEntryId: string,
  status: RoundEntryStatus,
  reason?: string,
): Promise<ApiRoundEntry> {
  const response = await apiClient.patch<ApiResponse<ApiRoundEntry>>(
    ENDPOINTS.timetrial.roundEntry(roundEntryId),
    { ...roundEntryBody(status, reason) },
  );
  return response.data;
}

/** "Next participant": menyelesaikan giliran peserta (status COMPLETED). Butuh `actions.nextParticipant`. */
export function completeParticipant(roundEntryId: string) {
  return updateRoundEntry(roundEntryId, "COMPLETED");
}

/**
 * "Did not start" (`dns = true`, status DNS) atau membatalkannya (`false`, kembali WAITING).
 * Butuh `actions.markDns` / `actions.undoDns`.
 */
export function markDns(roundEntryId: string, dns: boolean) {
  return updateRoundEntry(roundEntryId, dns ? "DNS" : "WAITING");
}

/** Membuka lagi peserta yang sudah DONE (batal "Next participant"). Butuh `actions.reopen`. */
export function reopenParticipant(roundEntryId: string) {
  return updateRoundEntry(roundEntryId, "IN_PROGRESS");
}

/**
 * "Skip to next": memindahkan peserta ke akhir antrean tanpa memakai apa pun (butuh
 * `actions.skip`). MOCK: endpoint baru. Mengembalikan antrean terbaru.
 */
export async function skipParticipant(
  competitionId: string,
  entryId: string,
): Promise<Queue> {
  const response = await apiClient.post<ApiResponse<ApiQueue>>(
    ENDPOINTS.timetrial.skip(competitionId, entryId),
    {},
  );
  return fromApi(response.data);
}
