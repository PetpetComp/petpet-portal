import { apiClient, ApiError } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { ApiResponse } from "@/types/common";
import {
  fromApi,
  scorecardFromApi,
  type ApiCreateScorecardBody,
  type ApiJudging,
  type ApiPutCriterionScoresBody,
  type ApiScorecard,
  type ApiUpdateScorecardBody,
  type Judging,
  type Scorecard,
} from "./types";

/**
 * Error khusus Submit and lock: scorecard BERHASIL di-submit (status SUBMITTED di server) tetapi
 * Lock gagal. Layar menawarkan "Retry" yang memanggil `lockScorecard(scorecardId)` saja (JANGAN
 * mengulang submit). `submitted` berisi scorecard yang sudah SUBMITTED untuk menyegarkan layar.
 */
export class LockError extends Error {
  /** Scorecard yang sudah SUBMITTED dan menunggu lock. */
  readonly scorecardId: string;
  readonly submitted: Scorecard;
  /** Error asli dari lock. */
  readonly original: unknown;

  constructor(submitted: Scorecard, original: unknown) {
    super(
      original instanceof Error
        ? `Scorecard submitted but not locked: ${original.message}`
        : "Scorecard submitted but not locked.",
    );
    this.name = "LockError";
    this.scorecardId = submitted.id;
    this.submitted = submitted;
    this.original = original;
  }

  /** Status HTTP error asli (0 = jaringan putus), supaya layar bisa membedakan "coba lagi" dari "ditolak". */
  get status(): number | null {
    return this.original instanceof ApiError ? this.original.status : null;
  }
}

/**
 * Kriteria, antrean peserta (urutan check-in), dan scorecard milik pemanggil untuk satu
 * kompetisi Contest. MOCK: belum ada di backend (kontrak 15).
 */
export async function getJudging(competitionId: string): Promise<Judging> {
  const response = await apiClient.get<ApiResponse<ApiJudging>>(
    ENDPOINTS.judging.judging(competitionId),
  );
  return fromApi(response.data);
}

/** Satu scorecard lengkap dengan nilai per kriteria. Dipakai untuk sinkron ulang setelah jaringan putus. */
export async function getScorecard(scorecardId: string): Promise<Scorecard> {
  const response = await apiClient.get<ApiResponse<ApiScorecard>>(
    ENDPOINTS.judging.scorecard(scorecardId),
  );
  return scorecardFromApi(response.data);
}

/** Input membuat (atau memastikan ada) scorecard. */
export type EnsureScorecardInput = {
  /** `judging.roundId`. */
  roundId: string;
  entryId: string;
  /** `participant.scorecardId` bila sudah ada: tidak ada permintaan jaringan sama sekali. */
  scorecardId?: string | null;
  /** `judging.judge.staffAssignmentId`; dipakai memulihkan diri bila scorecard ternyata sudah ada. */
  staffAssignmentId?: string;
};

/** Body `POST /rounds/{uuid}/scorecards` dari input layar. */
export function createScorecardBody(
  input: Pick<EnsureScorecardInput, "entryId">,
): ApiCreateScorecardBody {
  return { entry_id: input.entryId };
}

/** True bila error ini penolakan "scorecard sudah ada" (422 backend asli, tanpa idempotensi). */
function isAlreadyExists(cause: unknown): boolean {
  return (
    cause instanceof ApiError &&
    cause.status === 422 &&
    /already have a scorecard/i.test(cause.message)
  );
}

/**
 * Memastikan scorecard (DRAFT) untuk satu peserta ada, lalu mengembalikan id-nya. Idempotent:
 * - `scorecardId` sudah diketahui -> dikembalikan tanpa permintaan;
 * - kalau belum -> `POST /rounds/{uuid}/scorecards`. Mock mengembalikan scorecard yang sudah ada
 *   untuk juri dan peserta yang sama; backend asli menjawab 422 "You already have a scorecard...",
 *   dan di kasus itu fungsi ini mencari scorecard milik `staffAssignmentId` di daftar ronde.
 * Dipanggil dari `useEnsureScorecard` pada simpanan pertama peserta (autosave malas).
 */
export async function ensureScorecard(
  input: EnsureScorecardInput,
): Promise<string> {
  if (input.scorecardId) return input.scorecardId;
  try {
    const response = await apiClient.post<ApiResponse<ApiScorecard>>(
      ENDPOINTS.judging.roundScorecards(input.roundId),
      { ...createScorecardBody(input) },
    );
    return response.data.uuid;
  } catch (cause) {
    if (!isAlreadyExists(cause) || !input.staffAssignmentId) throw cause;
    const list = await apiClient.get<ApiResponse<ApiScorecard[]>>(
      ENDPOINTS.judging.roundScorecards(input.roundId),
    );
    const mine = list.data.find(
      (s) =>
        s.entry_uuid === input.entryId &&
        s.staff_assignment_uuid === input.staffAssignmentId,
    );
    if (!mine) throw cause;
    return mine.uuid;
  }
}

/** Satu nilai kriteria yang diubah. `note` undefined = catatan tidak diubah. */
export type ScoreChange = {
  criterionId: string;
  score: number;
  note?: string;
};

/** Body `PUT /scorecards/{uuid}/criterion-scores`: hanya kriteria yang berubah. */
export function criterionScoresBody(
  changes: readonly ScoreChange[],
): ApiPutCriterionScoresBody {
  return {
    scores: changes.map((c) => ({
      criterion_id: c.criterionId,
      score: c.score,
      ...(c.note !== undefined ? { note: c.note } : {}),
    })),
  };
}

/**
 * Menyimpan nilai kriteria yang berubah (upsert per kriteria, kriteria lain tidak disentuh).
 * Scorecard harus DRAFT; yang sudah SUBMITTED atau LOCKED ditolak (mock 409).
 */
export async function saveScores(
  scorecardId: string,
  changes: readonly ScoreChange[],
): Promise<Scorecard> {
  const response = await apiClient.put<ApiResponse<ApiScorecard>>(
    ENDPOINTS.judging.criterionScores(scorecardId),
    { ...criterionScoresBody(changes) },
  );
  return scorecardFromApi(response.data);
}

/** Menyimpan catatan juri (keseluruhan peserta) tanpa mengubah status. Scorecard harus DRAFT. */
export async function saveJudgeNote(
  scorecardId: string,
  note: string,
): Promise<Scorecard> {
  const body: ApiUpdateScorecardBody = { judge_note: note };
  const response = await apiClient.patch<ApiResponse<ApiScorecard>>(
    ENDPOINTS.judging.scorecard(scorecardId),
    { ...body },
  );
  return scorecardFromApi(response.data);
}

/** Apakah error ini penolakan karena scorecard tidak lagi DRAFT (409 mock, 422 backend asli). */
function isNotEditable(cause: unknown): boolean {
  return (
    cause instanceof ApiError && (cause.status === 409 || cause.status === 422)
  );
}

/**
 * Mengunci scorecard SUBMITTED (final). Aman diulang: bila lock sebelumnya sebenarnya berhasil
 * (respons hilang di jaringan), server menolak dan scorecard dibaca ulang; yang sudah LOCKED
 * dianggap sukses. Dipanggil dari `submitAndLock` dan tombol "Retry lock".
 */
export async function lockScorecard(scorecardId: string): Promise<Scorecard> {
  try {
    const response = await apiClient.post<ApiResponse<ApiScorecard>>(
      ENDPOINTS.judging.lock(scorecardId),
      {},
    );
    return scorecardFromApi(response.data);
  } catch (cause) {
    if (!isNotEditable(cause)) throw cause;
    const current = await getScorecard(scorecardId);
    if (current.status === "LOCKED") return current;
    throw cause;
  }
}

/** Body `PATCH /scorecards/{uuid}` untuk Submit (catatan juri ikut bila diberikan). */
export function submitBody(judgeNote?: string): ApiUpdateScorecardBody {
  return {
    status: "SUBMITTED",
    ...(judgeNote !== undefined ? { judge_note: judgeNote } : {}),
  };
}

/**
 * Submit lalu lock, dua permintaan nyata (`PATCH` status SUBMITTED, lalu `POST .../lock`).
 * - Submit gagal (mis. 422 kriteria belum lengkap): error asli dilempar, tidak ada yang berubah.
 * - Submit ditolak karena scorecard sudah SUBMITTED (pengulangan): lanjut ke lock; sudah LOCKED:
 *   dikembalikan apa adanya.
 * - Submit berhasil tetapi lock gagal: melempar `LockError`; layar memanggil `lockScorecard`
 *   (atau `useRetryLock`) saja.
 * Dipanggil dari `useSubmitAndLock`.
 */
export async function submitAndLock(
  scorecardId: string,
  judgeNote?: string,
): Promise<Scorecard> {
  let submitted: Scorecard;
  try {
    const response = await apiClient.patch<ApiResponse<ApiScorecard>>(
      ENDPOINTS.judging.scorecard(scorecardId),
      { ...submitBody(judgeNote) },
    );
    submitted = scorecardFromApi(response.data);
  } catch (cause) {
    if (!isNotEditable(cause)) throw cause;
    const current = await getScorecard(scorecardId);
    if (current.status === "LOCKED") return current;
    if (current.status !== "SUBMITTED") throw cause;
    submitted = current;
  }
  try {
    return await lockScorecard(scorecardId);
  } catch (cause) {
    throw new LockError(submitted, cause);
  }
}
