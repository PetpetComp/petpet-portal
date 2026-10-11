import { apiClient, ApiError } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { ApiResponse } from "@/types/common";
import { DISQUALIFY_PENALTY_TYPE } from "./constants";
import {
  captureFromApi,
  fromApi,
  listFromApi,
  penaltyFromApi,
  sessionFromApi,
  type ApiCaptureFinishBody,
  type ApiConfirmMatchBody,
  type ApiCreatePenaltyBody,
  type ApiCreateSessionBody,
  type ApiFinishCapture,
  type ApiHeatEntry,
  type ApiMatch,
  type ApiMatchList,
  type ApiPenalty,
  type ApiRaceSession,
  type FinishCapture,
  type LaneOutcome,
  type Match,
  type MatchList,
  type Penalty,
  type RaceSession,
  type StopReason,
} from "./types";

/**
 * Error khusus Finish satu ketukan (keputusan 1A): capture BERHASIL tersimpan tetapi assign gagal.
 * Capture itu tetap UNASSIGNED di server; layar harus menawarkan "Retry" yang memanggil `assignFinish`
 * dengan `capture.id`, JANGAN mengetuk Finish lagi (itu membuat capture kedua).
 */
export class AssignFinishError extends Error {
  /** Capture yang sudah tersimpan dan menunggu ditetapkan. */
  readonly capture: FinishCapture;
  /** Peserta (entry) yang seharusnya menerima finish ini. */
  readonly entryId: string;
  /** Error asli dari assign. */
  readonly original: unknown;

  constructor(capture: FinishCapture, entryId: string, original: unknown) {
    super(
      original instanceof Error
        ? `Finish was recorded but not assigned: ${original.message}`
        : "Finish was recorded but not assigned.",
    );
    this.name = "AssignFinishError";
    this.capture = capture;
    this.entryId = entryId;
    this.original = original;
  }

  /** Status HTTP error asli (0 = jaringan putus), supaya layar bisa membedakan "coba lagi" dari "ditolak". */
  get status(): number | null {
    return this.original instanceof ApiError ? this.original.status : null;
  }
}

/** Daftar match satu kompetisi Race. MOCK: belum ada di backend (kontrak 13 bagian 13). */
export async function getMatches(competitionId: string): Promise<MatchList> {
  const response = await apiClient.get<ApiResponse<ApiMatchList>>(
    ENDPOINTS.matches.list(competitionId),
  );
  return listFromApi(response.data);
}

/** Satu match lengkap: lane, sesi, finish, penalti, dan `actions`. MOCK: belum ada di backend. */
export async function getMatch(matchId: string): Promise<Match> {
  const response = await apiClient.get<ApiResponse<ApiMatch>>(
    ENDPOINTS.matches.detail(matchId),
  );
  return fromApi(response.data);
}

/** Input membuat sesi (juga rematch bila `rematchOfSessionId` terisi). */
export type CreateSessionInput = {
  sessionNumber: number;
  countdownSeconds: number;
  cutoffTimeMs: number;
  rematchOfSessionId?: string | null;
};

/** Body `POST /heats/{uuid}/sessions` dari input layar. */
export function createSessionBody(
  input: CreateSessionInput,
): ApiCreateSessionBody {
  return {
    session_number: input.sessionNumber,
    countdown_seconds: input.countdownSeconds,
    cutoff_time_ms: input.cutoffTimeMs,
    ...(input.rematchOfSessionId
      ? { rematch_of_session_id: input.rematchOfSessionId }
      : {}),
  };
}

/** Membuat sesi balapan baru berstatus READY (butuh `actions.createSession` atau `actions.rematch`). */
export async function createSession(
  matchId: string,
  input: CreateSessionInput,
): Promise<RaceSession> {
  const response = await apiClient.post<ApiResponse<ApiRaceSession>>(
    ENDPOINTS.matches.sessions(matchId),
    { ...createSessionBody(input) },
  );
  return sessionFromApi(response.data);
}

/** Memulai sesi READY (butuh `actions.start`). Dipanggil saat hitung mundur di layar habis. */
export async function startSession(sessionId: string): Promise<RaceSession> {
  const response = await apiClient.post<ApiResponse<ApiRaceSession>>(
    ENDPOINTS.race.startSession(sessionId),
    {},
  );
  return sessionFromApi(response.data);
}

/** Menghentikan sesi RUNNING dengan satu alasan (butuh `actions.stop`). CUTOFF menjadi status CUTOFF. */
export async function stopSession(
  sessionId: string,
  reason: StopReason,
): Promise<RaceSession> {
  const response = await apiClient.post<ApiResponse<ApiRaceSession>>(
    ENDPOINTS.race.stopSession(sessionId),
    { stop_reason: reason },
  );
  return sessionFromApi(response.data);
}

/** Id idempotensi baru untuk satu ketukan Finish. Dibuat SEKALI per ketukan, dipakai ulang saat retry. */
export function newClientRequestId(): string {
  return crypto.randomUUID();
}

/** Input satu ketukan Finish di satu lane. */
export type CaptureFinishInput = {
  sessionId: string;
  /** Lihat `nextFinishOrder`. */
  finishOrder: number;
  /** Waktu yang dilihat operator (`elapsedMs`), dikirim apa adanya. */
  capturedTimeMs: number;
  /** Peserta (entry) pemilik lane yang diketuk. */
  entryId: string;
  /** Isi dengan id yang sama saat mengulang ketukan yang sama (retry setelah jaringan putus). */
  clientRequestId?: string;
};

/** Body `POST /sessions/{uuid}/finishes` dari input layar. */
export function captureBody(input: CaptureFinishInput): ApiCaptureFinishBody {
  return {
    finish_order: input.finishOrder,
    captured_time_ms: input.capturedTimeMs,
    ...(input.clientRequestId
      ? { client_request_id: input.clientRequestId }
      : {}),
  };
}

/** Hanya capture (tanpa assign). Dipakai `captureAndAssign`. */
export async function captureFinish(
  input: CaptureFinishInput,
): Promise<FinishCapture> {
  const response = await apiClient.post<ApiResponse<ApiFinishCapture>>(
    ENDPOINTS.race.finishes(input.sessionId),
    { ...captureBody(input) },
  );
  return captureFromApi(response.data);
}

/** Menetapkan capture ke satu entry (juga dipakai untuk retry setelah `AssignFinishError`). */
export async function assignFinish(
  captureId: string,
  entryId: string,
): Promise<FinishCapture> {
  const response = await apiClient.patch<ApiResponse<ApiFinishCapture>>(
    ENDPOINTS.race.assignFinish(captureId),
    { assigned_entry_id: entryId },
  );
  return captureFromApi(response.data);
}

/**
 * Finish SATU ketukan per lane (keputusan 1A): capture lalu langsung assign ke entry lane itu.
 * - Capture gagal: error asli dilempar, tidak ada yang tersimpan (aman diulang dengan
 *   `clientRequestId` yang sama; server mengembalikan capture yang sama bila request pertama
 *   sebenarnya sudah masuk).
 * - Capture berhasil tetapi assign gagal: melempar `AssignFinishError` berisi capture UNASSIGNED;
 *   layar memanggil `assignFinish(error.capture.id, error.entryId)` untuk mencoba lagi.
 * Dipanggil dari `useCaptureFinish`.
 */
export async function captureAndAssign(
  input: CaptureFinishInput,
): Promise<FinishCapture> {
  const capture = await captureFinish(input);
  try {
    return await assignFinish(capture.id, input.entryId);
  } catch (cause) {
    throw new AssignFinishError(capture, input.entryId, cause);
  }
}

/** Membatalkan satu finish (undo, void). Butuh `lane.actions.undoFinish`. */
export async function voidFinish(captureId: string): Promise<FinishCapture> {
  const response = await apiClient.post<ApiResponse<ApiFinishCapture>>(
    ENDPOINTS.race.voidFinish(captureId),
    {},
  );
  return captureFromApi(response.data);
}

/**
 * Menandai peserta Did not start (`dns = true`) atau membatalkannya (`false`) lewat
 * `PATCH /heat-entries/{uuid}` field `call_status`. Butuh `lane.actions.markDns` / `undoDns`.
 */
export async function markDns(
  heatEntryId: string,
  dns: boolean,
): Promise<ApiHeatEntry> {
  const response = await apiClient.patch<ApiResponse<ApiHeatEntry>>(
    ENDPOINTS.matches.heatEntry(heatEntryId),
    { call_status: dns ? "DNS" : "WAITING" },
  );
  return response.data;
}

/** Body penalti Disqualify (unit DISQUALIFICATION, nilai 0). */
export function disqualifyBody(reason: string): ApiCreatePenaltyBody {
  return {
    penalty_type: DISQUALIFY_PENALTY_TYPE,
    penalty_value: 0,
    penalty_unit: "DISQUALIFICATION",
    reason,
  };
}

/** Mendiskualifikasi peserta dengan satu alasan (butuh `lane.actions.disqualify`). */
export async function disqualify(
  entryId: string,
  reason: string,
): Promise<Penalty> {
  const response = await apiClient.post<ApiResponse<ApiPenalty>>(
    ENDPOINTS.race.penalties(entryId),
    { ...disqualifyBody(reason) },
  );
  return penaltyFromApi(response.data);
}

/** Mencabut satu penalti (butuh `lane.actions.undoDisqualify`). */
export async function revokePenalty(penaltyId: string): Promise<Penalty> {
  const response = await apiClient.post<ApiResponse<ApiPenalty>>(
    ENDPOINTS.race.revokePenalty(penaltyId),
    {},
  );
  return penaltyFromApi(response.data);
}

/** Body Confirm dari hasil `matchOutcomes`. */
export function confirmBody(
  outcomes: readonly LaneOutcome[],
): ApiConfirmMatchBody {
  return {
    results: outcomes.map((o) => ({
      heat_entry_uuid: o.heatEntryId,
      position: o.position,
      completed_time_ms: o.completedTimeMs,
      status: o.status,
    })),
  };
}

/**
 * Mengonfirmasi hasil match secara atomik (butuh `actions.confirm`): menulis semua peserta dan
 * menutup match dalam satu transaksi. MOCK: endpoint baru. Mengembalikan match terbaru (DONE).
 */
export async function confirmMatch(
  matchId: string,
  outcomes: readonly LaneOutcome[],
): Promise<Match> {
  const response = await apiClient.post<ApiResponse<ApiMatch>>(
    ENDPOINTS.matches.confirm(matchId),
    { ...confirmBody(outcomes) },
  );
  return fromApi(response.data);
}
