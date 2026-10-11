/**
 * Tipe domain Run Match (menjalankan satu match Race di Live Mode). Kontrak ada di
 * petpet-docs/_draft-runmatch.md (bagian "13. Run Match (Live Mode, Race)").
 *
 * Istilah (match = "heat" di backend petpet-service):
 * - RACE SESSION: satu kali balapan satu match. Status READY -> RUNNING -> FINISHED | CUTOFF.
 *   Rematch membuat sesi baru dan menandai sesi lama REMATCHED. COUNTDOWN ada di konstanta backend
 *   tetapi backend tidak pernah menyimpannya; hitung mundur 3-2-1 hanya terjadi di layar (klien).
 * - FINISH CAPTURE: satu ketukan tombol Finish. Menyimpan urutan (`finish_order`) dan waktu
 *   (`captured_time_ms`, dihitung dari jam klien sejak start). Status UNASSIGNED -> ASSIGNED ke
 *   satu entry, atau VOID (undo).
 * - PENALTY: hukuman untuk satu entry. Disqualify disimpan sebagai penalti berunit DISQUALIFICATION.
 * - CONFIRM: menulis `position` dan `completed_time_ms` ke tiap peserta match dan menutup match.
 *
 * Tipe `Api*` sama persis dengan petpet-service (snake_case, `*Data::toArray`) atau dengan kontrak
 * bila endpoint-nya baru. Tipe tanpa awalan `Api` (camelCase) adalah bentuk untuk layar.
 */
import type { MatchStatus } from "@/domains/drawing/types";
import type { ResultStatus } from "@/domains/results/types";

/** Status sesi balapan (`RaceSessionConstant`). */
export const RACE_SESSION_STATUSES = [
  "READY",
  "COUNTDOWN",
  "RUNNING",
  "FINISHED",
  "CUTOFF",
  "CANCELLED",
  "REMATCHED",
] as const;
export type RaceSessionStatus = (typeof RACE_SESSION_STATUSES)[number];

/** Alasan menghentikan sesi (`RaceSessionConstant::STOP_REASONS`). CUTOFF menghasilkan status CUTOFF. */
export const STOP_REASONS = [
  "MANUAL",
  "ALL_FINISHED",
  "CUTOFF",
  "TECHNICAL_ISSUE",
  "REMATCH",
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

/** Status penugasan satu finish capture (`FinishCaptureConstant`). */
export const ASSIGNMENT_STATUSES = ["UNASSIGNED", "ASSIGNED", "VOID"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Unit penalti (`PenaltyConstant::UNITS`). P5a hanya memakai DISQUALIFICATION. */
export const PENALTY_UNITS = [
  "MILLISECONDS",
  "POINTS",
  "POSITION",
  "DISQUALIFICATION",
] as const;
export type PenaltyUnit = (typeof PENALTY_UNITS)[number];

export const PENALTY_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type PenaltyStatus = (typeof PENALTY_STATUSES)[number];

/**
 * `heat_entries.call_status` (kolom string 30). Sebelum Confirm hanya WAITING atau DNS (tidak muncul).
 * Setelah Confirm kontrak ini mengisinya dengan hasil akhir: FINISHED, DNF, DQ, atau DNS.
 */
export const CALL_STATUSES = [
  "WAITING",
  "DNS",
  "FINISHED",
  "DNF",
  "DQ",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

/** Status match untuk daftar dan layar (diturunkan dari status heat). */
export const MATCH_RUN_STATUSES = ["NOT_STARTED", "RUNNING", "DONE"] as const;
export type MatchRunStatus = (typeof MATCH_RUN_STATUSES)[number];

export const MATCH_RUN_STATUS_LABEL: Record<MatchRunStatus, string> = {
  NOT_STARTED: "Not started",
  RUNNING: "Running",
  DONE: "Done",
};

/** Satu ketukan Finish persis seperti dikirim API (`FinishCaptureData::toArray`). */
export type ApiFinishCapture = {
  uuid: string;
  race_session_uuid: string;
  /** Unik per sesi, termasuk yang VOID; naik terus (lihat `nextFinishOrder`). */
  finish_order: number;
  /** Milidetik sejak start menurut jam klien; server tidak menghitung ulang. */
  captured_time_ms: number;
  assigned_entry_uuid: string | null;
  captured_by_uuid: string;
  captured_at: string;
  assignment_status: AssignmentStatus;
  assigned_by_uuid: string | null;
  assigned_at: string | null;
  /** USULAN (belum ada di backend): id idempotensi dari klien, supaya ulang kirim tidak menggandakan. */
  client_request_id?: string | null;
};

/** Satu sesi balapan persis seperti dikirim API (`RaceSessionData::toArray`). */
export type ApiRaceSession = {
  uuid: string;
  heat_uuid: string;
  session_number: number;
  rematch_of_session_uuid: string | null;
  countdown_seconds: number;
  cutoff_time_ms: number;
  started_at: string | null;
  stopped_at: string | null;
  stop_reason: StopReason | null;
  status: RaceSessionStatus;
  finish_captures: ApiFinishCapture[];
};

/** Satu penalti persis seperti dikirim API (`PenaltyData::toArray`). `penalty_value` berupa string. */
export type ApiPenalty = {
  uuid: string;
  entry_uuid: string;
  attempt_uuid: string | null;
  penalty_type: string;
  penalty_value: string;
  penalty_unit: PenaltyUnit;
  reason: string;
  issued_by_uuid: string;
  issued_at: string;
  status: PenaltyStatus;
};

/** Satu baris `heat_entries` persis seperti dikirim API (`HeatEntryData::toArray`). */
export type ApiHeatEntry = {
  uuid: string;
  heat_uuid: string;
  entry_uuid: string;
  lane_number: number | null;
  start_order: number | null;
  call_status: CallStatus;
  distance_to_finish: string | null;
  completed_time_ms: number | null;
  position: number | null;
  cot_flag: boolean;
};

/** Apa yang boleh dilakukan pemanggil pada satu lane (aturan dipegang backend/mock). */
export type ApiMatchLaneActions = {
  /** Tombol Finish di lane (sesi RUNNING, lane belum finish, bukan DNS/DQ). */
  finish: boolean;
  /** Batalkan finish lane ini (void). */
  undo_finish: boolean;
  /** Tandai Did not start. */
  mark_dns: boolean;
  /** Batalkan tanda DNS. */
  undo_dns: boolean;
  disqualify: boolean;
  /** Cabut diskualifikasi (revoke penalti). */
  undo_disqualify: boolean;
};

/** Satu lane dalam detail match: baris heat entry + data tampilan + penalti + `actions`. */
export type ApiMatchLane = ApiHeatEntry & {
  pet_name: string | null;
  pet_morph_name: string | null;
  owner_name: string;
  bib_number: string | null;
  /** Semua penalti entry ini (ACTIVE dan REVOKED), urut waktu terbit. */
  penalties: ApiPenalty[];
  actions: ApiMatchLaneActions;
};

/** Apa yang boleh dilakukan pemanggil pada match (aturan dipegang backend/mock). */
export type ApiMatchActions = {
  /** Membuat sesi pertama (belum ada sesi aktif atau sesi lama). Rematch memakai flag `rematch`. */
  create_session: boolean;
  start: boolean;
  /** Minimal satu ketukan Finish bisa diterima (sesi RUNNING). */
  finish: boolean;
  stop: boolean;
  /** Mengulang match: membuat sesi baru berstatus rematch dari sesi sekarang. */
  rematch: boolean;
  mark_dns: boolean;
  disqualify: boolean;
  /** Mengonfirmasi hasil (sesi FINISHED atau CUTOFF, match belum DONE). */
  confirm: boolean;
};

/** Nilai awal untuk membuat sesi, diturunkan dari rule aktif kompetisi. */
export type ApiSessionDefaults = {
  /** 0 bila rule mematikan countdown. */
  countdown_seconds: number;
  /** `competition_rules.time_limit_ms`; bila rule kosong, mock memakai 600000 (10 menit). */
  cutoff_time_ms: number;
};

/** `data` dari `GET /matches/{heat_uuid}` dan `POST /heats/{uuid}/confirm`. Bentuk baru (mock dulu). */
export type ApiMatch = {
  /** Uuid heat. */
  uuid: string;
  competition_uuid: string;
  round_uuid: string;
  /** `heat_number`. */
  match_number: number;
  /** Jumlah match di drawing ("Match 2/9"). */
  total_matches: number;
  purpose: string;
  arena_name: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  /** Status mentah `competition_heats.status`. */
  heat_status: MatchStatus;
  /** Turunan: SCHEDULED -> NOT_STARTED, IN_PROGRESS -> RUNNING, COMPLETED -> DONE. */
  status: MatchRunStatus;
  session_defaults: ApiSessionDefaults;
  /** Urut menurut `lane_number`. */
  lanes: ApiMatchLane[];
  /** Semua sesi match ini (termasuk REMATCHED), urut menurut `session_number`. */
  sessions: ApiRaceSession[];
  /** Sesi yang berlaku sekarang (nomor tertinggi yang belum REMATCHED); null bila belum ada. */
  current_session_uuid: string | null;
  actions: ApiMatchActions;
};

/** Satu lane rencana dalam daftar match. */
export type ApiMatchPlannedLane = {
  lane_number: number;
  entry_uuid: string;
  pet_name: string | null;
  owner_name: string;
  bib_number: string | null;
};

/** Satu baris `GET /competitions/{uuid}/matches`. */
export type ApiMatchListItem = {
  /** Uuid heat. */
  uuid: string;
  match_number: number;
  status: MatchRunStatus;
  heat_status: MatchStatus;
  planned_lanes: ApiMatchPlannedLane[];
  /** Sesi yang berlaku (ringkas); null bila belum ada sesi. */
  current_session: {
    uuid: string;
    session_number: number;
    status: RaceSessionStatus;
  } | null;
  session_count: number;
};

/** `data` dari `GET /competitions/{uuid}/matches`. Bentuk baru (mock dulu). */
export type ApiMatchList = {
  competition_uuid: string;
  /** NOT_DRAWN bila drawing belum di-lock (daftar kosong). */
  drawing_status: "NOT_DRAWN" | "LOCKED";
  items: ApiMatchListItem[];
};

/** Body `POST /heats/{uuid}/sessions` (backend `CreateRaceSessionRequest`). */
export type ApiCreateSessionBody = {
  session_number: number;
  countdown_seconds?: number | null;
  cutoff_time_ms: number;
  rematch_of_session_id?: string | null;
};

/** Body `POST /sessions/{uuid}/finishes` (`CaptureFinishRequest` + usulan `client_request_id`). */
export type ApiCaptureFinishBody = {
  finish_order: number;
  captured_time_ms: number;
  client_request_id?: string;
};

/** Body `POST /entries/{uuid}/penalties` (`CreatePenaltyRequest`). */
export type ApiCreatePenaltyBody = {
  penalty_type: string;
  penalty_value: number;
  penalty_unit: PenaltyUnit;
  reason: string;
  attempt_id?: string | null;
};

/** Satu hasil lane dalam body Confirm. */
export type ApiConfirmResult = {
  heat_entry_uuid: string;
  position: number;
  /** Wajib angka bila FINISHED, wajib null selain itu. */
  completed_time_ms: number | null;
  status: ResultStatus;
};

/** Body `POST /heats/{uuid}/confirm`. Bentuk baru, atomik. */
export type ApiConfirmMatchBody = { results: ApiConfirmResult[] };

// ---------------------------------------------------------------------------
// Bentuk untuk layar
// ---------------------------------------------------------------------------

export type FinishCapture = {
  id: string;
  sessionId: string;
  finishOrder: number;
  capturedTimeMs: number;
  assignedEntryId: string | null;
  assignmentStatus: AssignmentStatus;
  capturedAt: string;
};

export type RaceSession = {
  id: string;
  matchId: string;
  number: number;
  rematchOfId: string | null;
  countdownSeconds: number;
  cutoffTimeMs: number;
  startedAt: string | null;
  stoppedAt: string | null;
  stopReason: StopReason | null;
  status: RaceSessionStatus;
  captures: FinishCapture[];
};

export type Penalty = {
  id: string;
  entryId: string;
  type: string;
  unit: PenaltyUnit;
  value: number;
  reason: string;
  status: PenaltyStatus;
  issuedAt: string;
};

/** Finish aktif satu lane (capture ASSIGNED di sesi yang berlaku). */
export type LaneFinish = {
  captureId: string;
  finishOrder: number;
  capturedTimeMs: number;
};

export type MatchLane = {
  heatEntryId: string;
  entryId: string;
  laneNumber: number;
  petName: string;
  petMorphName: string;
  ownerName: string;
  bibNumber: string;
  callStatus: CallStatus;
  /** Hasil tertulis setelah Confirm; null sebelumnya. */
  position: number | null;
  completedTimeMs: number | null;
  finish: LaneFinish | null;
  penalties: Penalty[];
  /** Penalti DISQUALIFICATION yang masih ACTIVE; null bila tidak didiskualifikasi. */
  disqualification: Penalty | null;
  actions: {
    finish: boolean;
    undoFinish: boolean;
    markDns: boolean;
    undoDns: boolean;
    disqualify: boolean;
    undoDisqualify: boolean;
  };
};

export type MatchActions = {
  createSession: boolean;
  start: boolean;
  finish: boolean;
  stop: boolean;
  rematch: boolean;
  markDns: boolean;
  disqualify: boolean;
  confirm: boolean;
};

export type Match = {
  id: string;
  competitionId: string;
  number: number;
  totalMatches: number;
  status: MatchRunStatus;
  heatStatus: MatchStatus;
  startedAt: string | null;
  finishedAt: string | null;
  sessionDefaults: { countdownSeconds: number; cutoffTimeMs: number };
  lanes: MatchLane[];
  sessions: RaceSession[];
  /** Sesi yang berlaku sekarang; null bila match belum punya sesi. */
  currentSession: RaceSession | null;
  actions: MatchActions;
};

export type MatchPlannedLane = {
  laneNumber: number;
  entryId: string;
  petName: string;
  ownerName: string;
  bibNumber: string;
};

export type MatchSummary = {
  id: string;
  number: number;
  status: MatchRunStatus;
  heatStatus: MatchStatus;
  plannedLanes: MatchPlannedLane[];
  currentSession: {
    id: string;
    number: number;
    status: RaceSessionStatus;
  } | null;
  sessionCount: number;
};

export type MatchList = {
  competitionId: string;
  drawingLocked: boolean;
  items: MatchSummary[];
  doneCount: number;
  /** Match pertama yang belum DONE (yang berikutnya dijalankan); null bila semua selesai atau kosong. */
  nextMatchId: string | null;
};

/** Hasil satu lane untuk body Confirm, dihitung oleh `rankFinishes`. */
export type LaneOutcome = {
  heatEntryId: string;
  position: number;
  status: ResultStatus;
  completedTimeMs: number | null;
};

// ---------------------------------------------------------------------------
// Pemetaan API -> layar
// ---------------------------------------------------------------------------

/** Mengubah satu finish capture API ke bentuk layar. Dipanggil dari `sessionFromApi` dan api.ts. */
export function captureFromApi(row: ApiFinishCapture): FinishCapture {
  return {
    id: row.uuid,
    sessionId: row.race_session_uuid,
    finishOrder: row.finish_order,
    capturedTimeMs: row.captured_time_ms,
    assignedEntryId: row.assigned_entry_uuid,
    assignmentStatus: row.assignment_status,
    capturedAt: row.captured_at,
  };
}

/** Mengubah satu sesi API ke bentuk layar; capture diurutkan menurut `finish_order`. */
export function sessionFromApi(row: ApiRaceSession): RaceSession {
  return {
    id: row.uuid,
    matchId: row.heat_uuid,
    number: row.session_number,
    rematchOfId: row.rematch_of_session_uuid,
    countdownSeconds: row.countdown_seconds,
    cutoffTimeMs: row.cutoff_time_ms,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    stopReason: row.stop_reason,
    status: row.status,
    captures: row.finish_captures
      .map(captureFromApi)
      .sort((a, b) => a.finishOrder - b.finishOrder),
  };
}

/** Mengubah satu penalti API ke bentuk layar (`penalty_value` string menjadi angka). */
export function penaltyFromApi(row: ApiPenalty): Penalty {
  return {
    id: row.uuid,
    entryId: row.entry_uuid,
    type: row.penalty_type,
    unit: row.penalty_unit,
    value: Number(row.penalty_value),
    reason: row.reason,
    status: row.status,
    issuedAt: row.issued_at,
  };
}

/**
 * Mengubah satu lane API ke bentuk layar. `finish` diambil dari capture ASSIGNED di sesi yang
 * berlaku (`current`) milik entry lane ini; sesi lama (REMATCHED) tidak dihitung.
 * Dipanggil dari `fromApi`.
 */
export function laneFromApi(
  row: ApiMatchLane,
  current: RaceSession | null,
): MatchLane {
  const capture = current?.captures.find(
    (c) =>
      c.assignmentStatus === "ASSIGNED" && c.assignedEntryId === row.entry_uuid,
  );
  const penalties = row.penalties.map(penaltyFromApi);
  return {
    heatEntryId: row.uuid,
    entryId: row.entry_uuid,
    laneNumber: row.lane_number ?? row.start_order ?? 0,
    petName: row.pet_name ?? "Unnamed pet",
    petMorphName: row.pet_morph_name ?? "",
    ownerName: row.owner_name,
    bibNumber: row.bib_number ?? "",
    callStatus: row.call_status,
    position: row.position,
    completedTimeMs: row.completed_time_ms,
    finish: capture
      ? {
          captureId: capture.id,
          finishOrder: capture.finishOrder,
          capturedTimeMs: capture.capturedTimeMs,
        }
      : null,
    penalties,
    disqualification:
      penalties.find(
        (p) => p.unit === "DISQUALIFICATION" && p.status === "ACTIVE",
      ) ?? null,
    actions: {
      finish: row.actions.finish,
      undoFinish: row.actions.undo_finish,
      markDns: row.actions.mark_dns,
      undoDns: row.actions.undo_dns,
      disqualify: row.actions.disqualify,
      undoDisqualify: row.actions.undo_disqualify,
    },
  };
}

/** Mengubah respons detail match ke bentuk layar. Dipanggil dari api.ts; lane diurutkan menurut nomor lane. */
export function fromApi(data: ApiMatch): Match {
  const sessions = data.sessions
    .map(sessionFromApi)
    .sort((a, b) => a.number - b.number);
  const currentSession =
    sessions.find((s) => s.id === data.current_session_uuid) ?? null;
  return {
    id: data.uuid,
    competitionId: data.competition_uuid,
    number: data.match_number,
    totalMatches: data.total_matches,
    status: data.status,
    heatStatus: data.heat_status,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    sessionDefaults: {
      countdownSeconds: data.session_defaults.countdown_seconds,
      cutoffTimeMs: data.session_defaults.cutoff_time_ms,
    },
    lanes: data.lanes
      .map((lane) => laneFromApi(lane, currentSession))
      .sort((a, b) => a.laneNumber - b.laneNumber),
    sessions,
    currentSession,
    actions: {
      createSession: data.actions.create_session,
      start: data.actions.start,
      finish: data.actions.finish,
      stop: data.actions.stop,
      rematch: data.actions.rematch,
      markDns: data.actions.mark_dns,
      disqualify: data.actions.disqualify,
      confirm: data.actions.confirm,
    },
  };
}

/** Mengubah daftar match API ke bentuk layar; urut menurut nomor match. */
export function listFromApi(data: ApiMatchList): MatchList {
  const items: MatchSummary[] = data.items
    .map((row) => ({
      id: row.uuid,
      number: row.match_number,
      status: row.status,
      heatStatus: row.heat_status,
      plannedLanes: row.planned_lanes
        .map((lane) => ({
          laneNumber: lane.lane_number,
          entryId: lane.entry_uuid,
          petName: lane.pet_name ?? "Unnamed pet",
          ownerName: lane.owner_name,
          bibNumber: lane.bib_number ?? "",
        }))
        .sort((a, b) => a.laneNumber - b.laneNumber),
      currentSession: row.current_session
        ? {
            id: row.current_session.uuid,
            number: row.current_session.session_number,
            status: row.current_session.status,
          }
        : null,
      sessionCount: row.session_count,
    }))
    .sort((a, b) => a.number - b.number);
  return {
    competitionId: data.competition_uuid,
    drawingLocked: data.drawing_status === "LOCKED",
    items,
    doneCount: items.filter((m) => m.status === "DONE").length,
    nextMatchId: items.find((m) => m.status !== "DONE")?.id ?? null,
  };
}
