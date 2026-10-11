/**
 * Tipe domain Time trial (Live Mode). Kontrak ada di petpet-docs/_draft-timetrial.md
 * (bagian "14. Time trial (Live Mode)").
 *
 * Istilah (untuk yang baru di domain ini):
 * - TIME TRIAL: hewan berlari SATU PER SATU melawan jam. (Race: beberapa hewan sekaligus.)
 * - QUEUE (antrean): urutan tampil peserta. Hasil undian (Drawing) kompetisi TIME_TRIAL; di backend
 *   `round_entries` (`queue_number`, `queue_position`, `drawing_order`) pada ronde 1.
 * - ATTEMPT: satu percobaan lari seorang peserta (`attempts`). Tiap peserta punya paling banyak
 *   `attempt_limit` percobaan yang DIHITUNG (rule kompetisi). Status: WAITING -> RUNNING ->
 *   FINISHED, atau TIMEOUT / DNF / DSQ / RETRY / FALSE_START.
 * - TIMER RESULT: waktu resmi satu attempt (`raw_duration_ms` + `penalty_ms`). Disimpan terpisah
 *   dari status attempt, lewat `POST /attempts/{uuid}/timer-result`.
 * - BEST TIME: waktu terbaik seorang peserta = attempt FINISHED tercepat (+ penalti). Itulah
 *   yang menentukan peringkatnya.
 * - CUT-OFF: batas waktu SATU attempt. Lewat dari itu attempt otomatis TIMEOUT.
 * - RETRY (keputusan 3A): false start atau ulang tidak memakai jatah. Hanya attempt berstatus
 *   FINISHED, TIMEOUT, DNF, DSQ yang dihitung ke `attempt_limit`.
 *
 * Tipe `Api*` sama persis dengan petpet-service (snake_case, `AttemptData::toArray`, dst.) atau
 * dengan kontrak bila endpoint-nya baru (antrean). Tipe tanpa awalan `Api` (camelCase) adalah
 * bentuk untuk layar.
 */
import type { DrawingStatus } from "@/domains/drawing/types";
import {
  penaltyFromApi,
  type ApiPenalty,
  type Penalty,
} from "@/domains/matches/types";

/** Status attempt (`AttemptConstant`). */
export const ATTEMPT_STATUSES = [
  "WAITING",
  "RUNNING",
  "FINISHED",
  "TIMEOUT",
  "DNF",
  "RETRY",
  "FALSE_START",
  "DSQ",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Status yang boleh diset tangan lewat `PATCH /attempts/{uuid}/status` (`MANUAL_STATUSES`). */
export const MANUAL_ATTEMPT_STATUSES = [
  "TIMEOUT",
  "DNF",
  "RETRY",
  "FALSE_START",
  "DSQ",
] as const;
export type ManualAttemptStatus = (typeof MANUAL_ATTEMPT_STATUSES)[number];

/** Dua cara membatalkan percobaan tanpa memakai jatah ("Retry" di layar, keputusan 3A). */
export const RETRY_STATUSES = ["FALSE_START", "RETRY"] as const;
export type RetryStatus = (typeof RETRY_STATUSES)[number];

/**
 * Status attempt yang MEMAKAI jatah `attempt_limit` (keputusan 3A). FALSE_START dan RETRY tidak.
 * WAITING dan RUNNING belum dihitung (percobaan masih berjalan).
 */
export const COUNTED_ATTEMPT_STATUSES = [
  "FINISHED",
  "TIMEOUT",
  "DNF",
  "DSQ",
] as const;

/** Status yang berarti attempt sedang "aktif" (menahan antrean): hanya satu per kompetisi. */
export const ACTIVE_ATTEMPT_STATUSES = ["WAITING", "RUNNING"] as const;

/** Status `round_entries.status` (`RoundEntryConstant::STATUSES`). */
export const ROUND_ENTRY_STATUSES = [
  "WAITING",
  "CALLED",
  "IN_PROGRESS",
  "JUDGING",
  "COMPLETED",
  "DNS",
  "DSQ",
] as const;
export type RoundEntryStatus = (typeof ROUND_ENTRY_STATUSES)[number];

/**
 * Status peserta di antrean (diturunkan server dari status round entry, attempt, dan penalti):
 * NOT_STARTED belum pernah lari, IN_PROGRESS sudah punya attempt tetapi belum "Next participant",
 * DONE gilirannya selesai, DNS tidak muncul, DQ didiskualifikasi.
 */
export const QUEUE_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "DNS",
  "DQ",
] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

export const QUEUE_STATE_LABEL: Record<QueueState, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  DNS: "Did not start",
  DQ: "Disqualified",
};

// ---------------------------------------------------------------------------
// Bentuk API
// ---------------------------------------------------------------------------

/** Waktu resmi satu attempt persis seperti dikirim API (`TimerResultData::toArray`). */
export type ApiTimerResult = {
  uuid: string;
  attempt_uuid: string;
  /** Milidetik menurut jam klien (apa yang dilihat operator); server tidak menghitung ulang. */
  raw_duration_ms: number;
  penalty_ms: number;
  /** `raw_duration_ms + penalty_ms`. */
  final_duration_ms: number;
  finish_status: string;
  recorded_by_uuid: string;
  recorded_at: string;
  /** USULAN (belum ada di backend): id idempotensi dari klien, supaya ulang kirim tidak menggandakan. */
  client_request_id?: string | null;
};

/** Satu attempt persis seperti dikirim API (`AttemptData::toArray`). */
export type ApiAttempt = {
  uuid: string;
  entry_uuid: string;
  round_uuid: string;
  /** Null untuk time trial (tidak ada heat). */
  heat_uuid: string | null;
  /** Unik per entry dan ronde, termasuk yang RETRY; naik terus (lihat `nextAttemptNumber`). */
  attempt_number: number;
  started_at: string | null;
  stopped_at: string | null;
  status: AttemptStatus;
  timer_result: ApiTimerResult | null;
  /** Dipakai kompetisi checkpoint; selalu kosong untuk time trial. */
  checkpoint_results: unknown[];
};

/** Satu baris `round_entries` persis seperti dikirim API (`RoundEntryData::toArray`). */
export type ApiRoundEntry = {
  uuid: string;
  round_uuid: string;
  entry_uuid: string;
  /** Urutan hasil undian (tetap). */
  drawing_order: number | null;
  /** Nomor antrean (tetap, tiket peserta). */
  queue_number: number;
  /** Posisi antrean sekarang; berubah saat "Skip to next". */
  queue_position: number;
  status: RoundEntryStatus;
  decision_reason: string | null;
};

/** Rule kompetisi yang dipakai layar; semuanya dari rule aktif kompetisi. */
export type ApiQueueRules = {
  /** Jumlah attempt yang dihitung per peserta (rule `attempt_limit`). */
  attempt_limit: number;
  /** Batas waktu satu attempt (rule `time_limit_ms`, bawaan 600000). */
  cutoff_ms: number;
  /** 0 bila hitung mundur dimatikan. */
  countdown_seconds: number;
  /** Rule `ranking_rule`; mock hanya memahami TIME_ASC (waktu terbaik tercepat). */
  ranking_rule: string[];
};

/** Apa yang boleh dilakukan pemanggil pada satu peserta (aturan dipegang backend/mock). */
export type ApiQueueItemActions = {
  /** Membuat attempt berikutnya berstatus WAITING ("Start attempt N"; dilanjutkan hitung mundur). */
  create_attempt: boolean;
  /** Memulai attempt WAITING (setelah hitung mundur di layar habis). */
  start: boolean;
  /** Menghentikan attempt RUNNING dan mencatat waktunya (satu ketukan). */
  stop: boolean;
  /** Membatalkan attempt aktif tanpa memakai jatah (false start / ulang). */
  retry: boolean;
  /** Membatalkan attempt terakhir yang dihitung (status RETRY), mengembalikan jatahnya. */
  undo: boolean;
  /** Menyelesaikan giliran peserta ("Next participant"). */
  next_participant: boolean;
  /** Memindahkan peserta ke akhir antrean tanpa memakai apa pun. */
  skip: boolean;
  mark_dns: boolean;
  undo_dns: boolean;
  disqualify: boolean;
  undo_disqualify: boolean;
  /** Membuka lagi peserta yang sudah DONE (batal "Next participant"). */
  reopen: boolean;
};

/** Satu peserta di antrean (`GET /competitions/{uuid}/queue`). Baru: MOCK dulu. */
export type ApiQueueItem = {
  /** `round_entries.uuid`; dipakai untuk `PATCH /round-entries/{uuid}`. */
  round_entry_uuid: string;
  entry_uuid: string;
  drawing_order: number;
  queue_number: number;
  queue_position: number;
  /** Status mentah `round_entries.status`. */
  status: RoundEntryStatus;
  /** Status turunan untuk layar. */
  state: QueueState;
  pet_name: string | null;
  pet_morph_name: string | null;
  owner_name: string;
  bib_number: string | null;
  /** Semua attempt peserta ini, urut menurut `attempt_number`, termasuk yang RETRY. */
  attempts: ApiAttempt[];
  /** Jumlah attempt yang dihitung ke jatah (keputusan 3A). */
  attempts_counted: number;
  /** Waktu terbaik (ms, sudah + penalti); null bila belum ada attempt FINISHED yang sah. */
  best_time_ms: number | null;
  /** `attempt_number` dari attempt terbaik; null bila `best_time_ms` null. */
  best_attempt_number: number | null;
  /** Peringkat 1..n menurut waktu terbaik (waktu sama: yang lebih dulu tercapai); null tanpa waktu. */
  best_rank: number | null;
  /** Semua penalti peserta ini (DQ = unit DISQUALIFICATION). */
  penalties: ApiPenalty[];
  actions: ApiQueueItemActions;
};

/** Ringkasan jumlah peserta per status. */
export type ApiQueueSummary = {
  total: number;
  not_started: number;
  in_progress: number;
  done: number;
  dns: number;
  dq: number;
};

/** `data` dari `GET /competitions/{uuid}/queue` dan `POST .../queue/{entryUuid}/skip`. */
export type ApiQueue = {
  competition_uuid: string;
  /** Ronde 1; dipakai untuk `POST /rounds/{uuid}/attempts`. */
  round_uuid: string;
  /** NOT_DRAWN selama undian belum di-lock; `items` kosong. */
  drawing_status: DrawingStatus;
  rules: ApiQueueRules;
  /** Peserta yang sedang mendapat giliran; null bila belum di-lock atau antrean selesai. */
  current_entry_uuid: string | null;
  /** Urut menurut `queue_position`. */
  items: ApiQueueItem[];
  summary: ApiQueueSummary;
};

/** Body `POST /rounds/{uuid}/attempts` (`CreateAttemptRequest`). */
export type ApiCreateAttemptBody = {
  entry_id: string;
  heat_id?: string;
  attempt_number: number;
};

/** Body `POST /attempts/{uuid}/timer-result` (`RecordTimerResultRequest` + usulan idempotensi). */
export type ApiRecordTimerResultBody = {
  raw_duration_ms: number;
  penalty_ms?: number;
  finish_status: string;
  client_request_id?: string;
};

/** Body `PATCH /attempts/{uuid}/status` (`UpdateAttemptStatusRequest`). */
export type ApiUpdateAttemptStatusBody = { status: ManualAttemptStatus };

/** Body `PATCH /round-entries/{uuid}` (`UpdateRoundEntryRequest`). */
export type ApiUpdateRoundEntryBody = {
  status?: RoundEntryStatus;
  decision_reason?: string | null;
};

// ---------------------------------------------------------------------------
// Bentuk layar
// ---------------------------------------------------------------------------

export type TimerResult = {
  id: string;
  attemptId: string;
  rawDurationMs: number;
  penaltyMs: number;
  /** Waktu resmi: `rawDurationMs + penaltyMs`. */
  finalDurationMs: number;
  finishStatus: string;
  recordedAt: string;
};

export type Attempt = {
  id: string;
  entryId: string;
  roundId: string;
  /** Nomor fisik percobaan (naik terus, termasuk RETRY). Label layar memakai `attemptsCounted + 1`. */
  number: number;
  status: AttemptStatus;
  startedAt: string | null;
  stoppedAt: string | null;
  result: TimerResult | null;
};

export type QueueItemActions = {
  createAttempt: boolean;
  start: boolean;
  stop: boolean;
  retry: boolean;
  undo: boolean;
  nextParticipant: boolean;
  skip: boolean;
  markDns: boolean;
  undoDns: boolean;
  disqualify: boolean;
  undoDisqualify: boolean;
  reopen: boolean;
};

export type QueueParticipant = {
  roundEntryId: string;
  entryId: string;
  drawingOrder: number;
  queueNumber: number;
  queuePosition: number;
  status: RoundEntryStatus;
  state: QueueState;
  petName: string;
  petMorphName: string;
  ownerName: string;
  bibNumber: string;
  attempts: Attempt[];
  attemptsCounted: number;
  bestTimeMs: number | null;
  bestAttemptNumber: number | null;
  bestRank: number | null;
  penalties: Penalty[];
  /** Penalti DISQUALIFICATION yang masih ACTIVE; null bila tidak didiskualifikasi. */
  disqualification: Penalty | null;
  /** Attempt WAITING atau RUNNING; null bila tidak ada. */
  activeAttempt: Attempt | null;
  actions: QueueItemActions;
};

export type QueueRules = {
  attemptLimit: number;
  cutoffMs: number;
  countdownSeconds: number;
  rankingRule: string[];
};

export type Queue = {
  competitionId: string;
  roundId: string;
  drawingLocked: boolean;
  rules: QueueRules;
  currentEntryId: string | null;
  participants: QueueParticipant[];
  summary: {
    total: number;
    notStarted: number;
    inProgress: number;
    done: number;
    dns: number;
    dq: number;
  };
  /** True bila ada peserta tetapi tidak ada lagi yang belum selesai (semua DONE, DNS, atau DQ). */
  finished: boolean;
};

// ---------------------------------------------------------------------------
// Pemetaan API -> layar
// ---------------------------------------------------------------------------

/** Mengubah satu timer result API ke bentuk layar. Dipanggil dari `attemptFromApi` dan api.ts. */
export function timerResultFromApi(row: ApiTimerResult): TimerResult {
  return {
    id: row.uuid,
    attemptId: row.attempt_uuid,
    rawDurationMs: row.raw_duration_ms,
    penaltyMs: row.penalty_ms,
    finalDurationMs: row.final_duration_ms,
    finishStatus: row.finish_status,
    recordedAt: row.recorded_at,
  };
}

/** Mengubah satu attempt API ke bentuk layar. Dipanggil dari `participantFromApi` dan api.ts. */
export function attemptFromApi(row: ApiAttempt): Attempt {
  return {
    id: row.uuid,
    entryId: row.entry_uuid,
    roundId: row.round_uuid,
    number: row.attempt_number,
    status: row.status,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    result: row.timer_result ? timerResultFromApi(row.timer_result) : null,
  };
}

/** Attempt aktif (WAITING atau RUNNING) dari daftar attempt; null bila tidak ada. */
function activeAttemptOf(attempts: readonly Attempt[]): Attempt | null {
  return (
    attempts.find((a) => a.status === "WAITING" || a.status === "RUNNING") ??
    null
  );
}

/**
 * Mengubah satu peserta antrean API ke bentuk layar: attempt diurutkan menurut nomor, nama
 * kosong diberi teks bawaan, dan `disqualification` diambil dari penalti DISQUALIFICATION ACTIVE.
 */
export function participantFromApi(row: ApiQueueItem): QueueParticipant {
  const attempts = row.attempts
    .map(attemptFromApi)
    .sort((a, b) => a.number - b.number);
  const penalties = row.penalties.map(penaltyFromApi);
  return {
    roundEntryId: row.round_entry_uuid,
    entryId: row.entry_uuid,
    drawingOrder: row.drawing_order,
    queueNumber: row.queue_number,
    queuePosition: row.queue_position,
    status: row.status,
    state: row.state,
    petName: row.pet_name ?? "Unnamed pet",
    petMorphName: row.pet_morph_name ?? "",
    ownerName: row.owner_name,
    bibNumber: row.bib_number ?? "",
    attempts,
    attemptsCounted: row.attempts_counted,
    bestTimeMs: row.best_time_ms,
    bestAttemptNumber: row.best_attempt_number,
    bestRank: row.best_rank,
    penalties,
    disqualification:
      penalties.find(
        (p) => p.unit === "DISQUALIFICATION" && p.status === "ACTIVE",
      ) ?? null,
    activeAttempt: activeAttemptOf(attempts),
    actions: {
      createAttempt: row.actions.create_attempt,
      start: row.actions.start,
      stop: row.actions.stop,
      retry: row.actions.retry,
      undo: row.actions.undo,
      nextParticipant: row.actions.next_participant,
      skip: row.actions.skip,
      markDns: row.actions.mark_dns,
      undoDns: row.actions.undo_dns,
      disqualify: row.actions.disqualify,
      undoDisqualify: row.actions.undo_disqualify,
      reopen: row.actions.reopen,
    },
  };
}

/** Mengubah respons antrean API ke bentuk layar. Dipanggil dari api.ts. */
export function fromApi(data: ApiQueue): Queue {
  const participants = data.items
    .map(participantFromApi)
    .sort((a, b) => a.queuePosition - b.queuePosition);
  return {
    competitionId: data.competition_uuid,
    roundId: data.round_uuid,
    drawingLocked: data.drawing_status === "LOCKED",
    rules: {
      attemptLimit: data.rules.attempt_limit,
      cutoffMs: data.rules.cutoff_ms,
      countdownSeconds: data.rules.countdown_seconds,
      rankingRule: data.rules.ranking_rule,
    },
    currentEntryId: data.current_entry_uuid,
    participants,
    summary: {
      total: data.summary.total,
      notStarted: data.summary.not_started,
      inProgress: data.summary.in_progress,
      done: data.summary.done,
      dns: data.summary.dns,
      dq: data.summary.dq,
    },
    finished:
      data.summary.total > 0 &&
      data.summary.not_started + data.summary.in_progress === 0,
  };
}
