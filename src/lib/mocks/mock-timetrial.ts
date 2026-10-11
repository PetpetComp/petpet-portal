import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { DEFAULT_CUTOFF_MS } from "@/domains/matches/constants";
import { PENALTY_UNITS, type ApiPenalty } from "@/domains/matches/types";
import {
  activeAttempt,
  attemptFactsFromApi,
  bestAttemptOf,
  countedAttempts,
  type BestAttempt,
} from "@/domains/timetrial/attempts";
import { shouldTimeout } from "@/domains/timetrial/cutoff";
import { DEFAULT_ATTEMPT_LIMIT } from "@/domains/timetrial/constants";
import { rankBestTimes } from "@/domains/timetrial/rank";
import {
  currentEntryOf,
  effectiveOrder,
  isTerminalState,
  participantActions,
  queueStateOf,
  withSkipped,
  type ParticipantRuleInput,
} from "@/domains/timetrial/rules";
import {
  MANUAL_ATTEMPT_STATUSES,
  ROUND_ENTRY_STATUSES,
  type ApiAttempt,
  type ApiQueue,
  type ApiQueueItem,
  type ApiQueueItemActions,
  type ApiQueueRules,
  type ApiRoundEntry,
  type ApiTimerResult,
  type AttemptStatus,
  type QueueItemActions,
  type QueueState,
  type RoundEntryStatus,
} from "@/domains/timetrial/types";
import { competitionRuleStore } from "./mock-competitions";
import {
  drawingChangeListeners,
  drawingStore,
  isQueueCompetition,
  resetDrawingStore,
  roundUuidOf,
  seedTimeTrialOrder,
  SEED_TIME_TRIAL_UUID,
  type StoredDrawing,
} from "./mock-drawing";
import {
  hasStaffAccess,
  intField,
  invalid,
  notFound,
  participantInfo,
  PENALTY_ROLES,
  requireState,
  RUN_ROLES,
} from "./mock-matches";
import { callerFor, forbidUnless, hasPermission, iso } from "./mock-records";
import { findOrThrow, nextUuid, store } from "./mock-store";
import type { MockCompetition, MockUser } from "./mock-types";

/**
 * Backend palsu untuk Time trial (kontrak petpet-docs/_draft-timetrial.md, bagian 14).
 * Route attempt dan round entry sudah ada di petpet-service (routes/api/attempts.php,
 * rounds.php, round-entries.php) dan bentuk responsnya SAMA PERSIS dengan `AttemptData`,
 * `TimerResultData`, `RoundEntryData`. Yang baru (mock dulu): `GET /competitions/{uuid}/queue`
 * dan `POST /competitions/{uuid}/queue/{entryUuid}/skip`, plus aturan keadaan yang backend belum
 * periksa (satu attempt aktif per kompetisi, jatah attempt, cut-off, idempotensi timer result).
 *
 * Antrean = match tunggal dari drawing terkunci kompetisi TIME_TRIAL (mock-drawing.ts); urutan
 * yang berlaku = urutan undian dengan peserta yang di-Skip dipindah ke akhir. Aturan hidup di sini
 * dan di `@/domains/timetrial/{rules,attempts,rank}` (fungsi murni yang sama dipakai tes layar);
 * layar hanya membaca `actions`.
 *
 * Kode status: 401 tanpa login, 403 bukan hak pemanggil, 404 tidak ada, 422 isi request atau aturan
 * yang SUDAH ada di backend (pesannya disalin), 409 aturan keadaan yang DITAMBAHKAN kontrak ini.
 */

/** Data round entry yang bisa berubah, dikunci menurut uuid entry (satu entry = satu round entry). */
type StoredRoundEntry = {
  status: RoundEntryStatus;
  decision_reason: string | null;
};

export const timetrialStore: {
  attempts: ApiAttempt[];
  roundEntries: Record<string, StoredRoundEntry>;
  penalties: ApiPenalty[];
  /** Per kompetisi: peserta yang di-Skip menurut urutan Skip (yang terakhir di ujung). */
  skips: Record<string, string[]>;
} = { attempts: [], roundEntries: {}, penalties: [], skips: {} };

// ---------------------------------------------------------------------------
// Seed dan reset
// ---------------------------------------------------------------------------

/** Satu attempt FINISHED lengkap dengan timer result, untuk seed. */
function seedFinished(
  entryUuid: string,
  number: number,
  rawMs: number,
  stoppedAt: string,
): ApiAttempt {
  const uuid = `att-${entryUuid}-${number}`;
  return {
    uuid,
    entry_uuid: entryUuid,
    round_uuid: roundUuidOf(SEED_TIME_TRIAL_UUID),
    heat_uuid: null,
    attempt_number: number,
    started_at: "2026-10-11T08:00:00+00:00",
    stopped_at: stoppedAt,
    status: "FINISHED",
    timer_result: {
      uuid: `tr-${uuid}`,
      attempt_uuid: uuid,
      raw_duration_ms: rawMs,
      penalty_ms: 0,
      final_duration_ms: rawMs,
      finish_status: "FINISHED",
      recorded_by_uuid: "u-organizer",
      recorded_at: stoppedAt,
      client_request_id: null,
    },
    checkpoint_results: [],
  };
}

/**
 * Seed: Glider Speed Trial (undian terkunci, ONGOING). Peserta pertama menurut antrean: dua attempt
 * FINISHED (41230 dan 38412 ms, terbaik 38412) dan sudah "Next participant" (DONE). Peserta kedua:
 * satu FALSE_START (tidak dihitung) dan satu FINISHED 44870 ms, masih IN_PROGRESS dan sedang giliran
 * (jatah tersisa dua). Sisanya belum mulai. Glider Time Trial sengaja tanpa data supaya undian
 * bisa dicoba. Dipanggil saat modul dimuat dan dari reset.
 */
function seedTimetrialState() {
  const [first, second] = seedTimeTrialOrder();
  timetrialStore.attempts = [];
  timetrialStore.roundEntries = {};
  timetrialStore.penalties = [];
  timetrialStore.skips = {};
  if (!first || !second) return;
  timetrialStore.attempts.push(
    seedFinished(first, 1, 41230, "2026-10-11T08:05:00+00:00"),
    seedFinished(first, 2, 38412, "2026-10-11T08:07:00+00:00"),
    {
      ...seedFinished(second, 1, 0, "2026-10-11T08:09:00+00:00"),
      status: "FALSE_START",
      timer_result: null,
    },
    seedFinished(second, 2, 44870, "2026-10-11T08:11:00+00:00"),
  );
  timetrialStore.roundEntries[first] = {
    status: "COMPLETED",
    decision_reason: null,
  };
  timetrialStore.roundEntries[second] = {
    status: "IN_PROGRESS",
    decision_reason: null,
  };
}

/**
 * Membuang data Time trial. `null` = semua (lalu seed ulang). Untuk satu kompetisi: attempt,
 * round entry, penalti, dan Skip dari peserta drawing-nya. Dipanggil dari `drawingChangeListeners`
 * SEBELUM drawing dihapus (registrasi dibuka lagi, atau reset).
 */
function purgeTimetrialState(competitionUuid: string | null) {
  if (competitionUuid === null) {
    seedTimetrialState();
    return;
  }
  const entryUuids = new Set(
    (drawingStore.drawings[competitionUuid]?.matches ?? []).flatMap(
      (m) => m.entry_uuids,
    ),
  );
  timetrialStore.attempts = timetrialStore.attempts.filter(
    (a) => !entryUuids.has(a.entry_uuid),
  );
  timetrialStore.penalties = timetrialStore.penalties.filter(
    (p) => !entryUuids.has(p.entry_uuid),
  );
  for (const uuid of entryUuids) delete timetrialStore.roundEntries[uuid];
  delete timetrialStore.skips[competitionUuid];
}

drawingChangeListeners.push(purgeTimetrialState);
seedTimetrialState();

/** Mengembalikan data Time trial (dan drawing) ke seed. Dipanggil dari tes. */
export function resetTimetrialStore() {
  // Reset drawing memanggil `purgeTimetrialState(null)` yang me-seed ulang attempt.
  resetDrawingStore();
}

// ---------------------------------------------------------------------------
// Aturan akses
// ---------------------------------------------------------------------------

/** Peran yang boleh mengubah status attempt: peran jalan ditambah Head judge (backend: TIMER_OPERATOR, HEAD_JUDGE). */
const STATUS_ROLES = [...RUN_ROLES, "HEAD_JUDGE"] as const;

const canRun = (user: MockUser, competition: MockCompetition) =>
  hasStaffAccess(user, competition, RUN_ROLES);

const canSetStatus = (user: MockUser, competition: MockCompetition) =>
  hasStaffAccess(user, competition, STATUS_ROLES);

const canPenalize = (user: MockUser, competition: MockCompetition) =>
  hasStaffAccess(user, competition, PENALTY_ROLES);

/** Hak melihat: terkait event dengan `scoring.view` (sama dengan Drawing/Results), atau boleh menjalankan. */
function canView(user: MockUser, competition: MockCompetition): boolean {
  const caller = callerFor(user, competition.event_uuid);
  return (
    (caller.relatedToEvent && hasPermission(caller, PERMISSION.SCORING_VIEW)) ||
    canRun(user, competition)
  );
}

/** Hanya tipe TIME_TRIAL punya antrean dan attempt; tipe lain 422. */
function requireTimeTrial(competition: MockCompetition) {
  if (!isQueueCompetition(competition.uuid))
    throw new ApiError(
      422,
      "Time trial queue is not available for this competition type.",
    );
}

const RUNNABLE_COMPETITION_STATUSES = ["SCHEDULED", "ONGOING"];

// ---------------------------------------------------------------------------
// Pencarian data
// ---------------------------------------------------------------------------

/** Kompetisi dari uuid ronde mock (`round-<competition uuid>-1`); 404 bila tidak ada atau belum di-lock. */
function competitionOfRound(roundUuid: string): MockCompetition {
  const match = /^round-(.+)-1$/.exec(roundUuid);
  const competition = match
    ? store.competitions.find((c) => c.uuid === match[1])
    : undefined;
  // Ronde baru "ada" setelah drawing di-lock (di backend asli ronde dibuat saat Lock).
  if (!competition || !drawingStore.drawings[competition.uuid])
    throw notFound("Round");
  return competition;
}

const attemptOf = (uuid: string): ApiAttempt => {
  const attempt = timetrialStore.attempts.find((a) => a.uuid === uuid);
  if (!attempt) throw notFound("Attempt");
  return attempt;
};

const attemptsOf = (entryUuid: string): ApiAttempt[] =>
  timetrialStore.attempts
    .filter((a) => a.entry_uuid === entryUuid)
    .sort((a, b) => a.attempt_number - b.attempt_number);

const penaltiesOf = (entryUuid: string): ApiPenalty[] =>
  timetrialStore.penalties
    .filter((p) => p.entry_uuid === entryUuid)
    .sort((a, b) => a.issued_at.localeCompare(b.issued_at));

const activeDisqualification = (entryUuid: string): ApiPenalty | null =>
  penaltiesOf(entryUuid).find(
    (p) => p.penalty_unit === "DISQUALIFICATION" && p.status === "ACTIVE",
  ) ?? null;

const roundEntryUuidOf = (entryUuid: string) => `re-${entryUuid}`;

/** Kebalikan `roundEntryUuidOf`: uuid entry, atau null bila bukan uuid round entry mock. */
const entryUuidOfRoundEntry = (uuid: string): string | null =>
  uuid.startsWith("re-") ? uuid.slice(3) : null;

const roundEntryState = (entryUuid: string): StoredRoundEntry =>
  timetrialStore.roundEntries[entryUuid] ?? {
    status: "WAITING",
    decision_reason: null,
  };

/** Kompetisi time trial yang memuat entry di antrean terkunci; null bila entry tidak ada di antrean. */
function competitionOfQueuedEntry(entryUuid: string): MockCompetition | null {
  for (const [competitionUuid, drawing] of Object.entries(
    drawingStore.drawings,
  )) {
    if (
      isQueueCompetition(competitionUuid) &&
      drawing.matches.some((m) => m.entry_uuids.includes(entryUuid))
    )
      return findOrThrow(store.competitions, competitionUuid, "Competition");
  }
  return null;
}

/** True bila entry berada di antrean Time trial terkunci. Dipakai mock-request untuk memilih route penalti. */
export function isTimeTrialEntry(entryUuid: string): boolean {
  return competitionOfQueuedEntry(entryUuid) !== null;
}

/** True bila penalti ini milik peserta Time trial. Dipakai mock-request untuk memilih route revoke. */
export function isTimeTrialPenalty(penaltyUuid: string): boolean {
  return timetrialStore.penalties.some((p) => p.uuid === penaltyUuid);
}

/** Rule aktif kompetisi (yang `is_active`, kalau tidak ada versi tertinggi). */
function rulesOf(competitionUuid: string): ApiQueueRules {
  const rules = competitionRuleStore.rules.filter(
    (r) => r.competition_uuid === competitionUuid,
  );
  const rule =
    rules.find((r) => r.is_active) ??
    rules.reduce<(typeof rules)[number] | null>(
      (best, r) => (!best || r.version > best.version ? r : best),
      null,
    );
  return {
    attempt_limit: rule?.attempt_limit ?? DEFAULT_ATTEMPT_LIMIT,
    cutoff_ms: rule?.time_limit_ms ?? DEFAULT_CUTOFF_MS,
    countdown_seconds: rule
      ? rule.countdown_enabled
        ? rule.countdown_seconds
        : 0
      : 3,
    ranking_rule: rule?.ranking_rule ?? ["TIME_ASC"],
  };
}

// ---------------------------------------------------------------------------
// Keadaan antrean (dihitung ulang dari data tersimpan di setiap permintaan)
// ---------------------------------------------------------------------------

/** Satu peserta beserta semua yang diturunkan dari data tersimpan. */
type Row = {
  entryUuid: string;
  roundEntry: StoredRoundEntry;
  attempts: ApiAttempt[];
  penalties: ApiPenalty[];
  disqualified: boolean;
  state: QueueState;
  counted: number;
  best: BestAttempt | null;
  drawingOrder: number;
  queuePosition: number;
  hasActive: boolean;
};

/** Keadaan satu antrean pada satu saat. */
type Snapshot = {
  competition: MockCompetition;
  drawing: StoredDrawing | undefined;
  rules: ApiQueueRules;
  /** Undian terkunci dan kompetisi SCHEDULED atau ONGOING. */
  open: boolean;
  /** Urut posisi antrean sekarang. */
  rows: Row[];
  currentEntryUuid: string | null;
  ranks: Map<string, number>;
};

/**
 * Membangun keadaan antrean satu kompetisi: urutan berlaku (undian + Skip), status tiap peserta,
 * waktu terbaik, peringkat, dan siapa yang sedang giliran. Dipanggil dari semua route.
 */
function snapshotOf(competition: MockCompetition): Snapshot {
  const drawing = drawingStore.drawings[competition.uuid];
  const drawn = drawing?.matches[0]?.entry_uuids ?? [];
  const order = effectiveOrder(
    drawn,
    timetrialStore.skips[competition.uuid] ?? [],
  );
  const rows: Row[] = order.map((entryUuid, index) => {
    const attempts = attemptsOf(entryUuid);
    const roundEntry = roundEntryState(entryUuid);
    const disqualified = activeDisqualification(entryUuid) !== null;
    const facts = attempts.map(attemptFactsFromApi);
    return {
      entryUuid,
      roundEntry,
      attempts,
      penalties: penaltiesOf(entryUuid),
      disqualified,
      state: queueStateOf(roundEntry.status, disqualified),
      counted: countedAttempts(facts),
      best: bestAttemptOf(facts),
      drawingOrder: drawn.indexOf(entryUuid) + 1,
      queuePosition: index + 1,
      hasActive: activeAttempt(facts) !== null,
    };
  });
  const ranks = rankBestTimes(
    rows.map((r) => ({
      entryId: r.entryUuid,
      drawingOrder: r.drawingOrder,
      bestTimeMs: r.best?.timeMs ?? null,
      bestStoppedAt: r.best?.stoppedAt ?? null,
      disqualified: r.disqualified,
    })),
  );
  return {
    competition,
    drawing,
    rules: rulesOf(competition.uuid),
    open:
      drawing !== undefined &&
      RUNNABLE_COMPETITION_STATUSES.includes(competition.status),
    rows,
    currentEntryUuid: currentEntryOf(
      rows.map((r) => ({
        entryId: r.entryUuid,
        state: r.state,
        hasActiveAttempt: r.hasActive,
      })),
    ),
    ranks,
  };
}

/** Baris satu entry di antrean; 404 bila entry tidak ada di antrean ini. */
function rowOf(snapshot: Snapshot, entryUuid: string): Row {
  const row = snapshot.rows.find((r) => r.entryUuid === entryUuid);
  if (!row) throw notFound("Queue participant");
  return row;
}

/** Masukan aturan `participantActions` untuk satu baris dan hak pemanggil. */
function ruleInputOf(
  snapshot: Snapshot,
  row: Row,
  runner: boolean,
  penalizer: boolean,
): ParticipantRuleInput {
  return {
    state: row.state,
    disqualified: row.disqualified,
    attempts: row.attempts.map(attemptFactsFromApi),
    attemptLimit: snapshot.rules.attempt_limit,
    isCurrent: snapshot.currentEntryUuid === row.entryUuid,
    otherActive: snapshot.rows.some(
      (r) => r.entryUuid !== row.entryUuid && r.hasActive,
    ),
    hasOthersWaiting: snapshot.rows.some(
      (r) => r.entryUuid !== row.entryUuid && !isTerminalState(r.state),
    ),
    open: snapshot.open,
    runner,
    penalizer,
  };
}

/** Bentuk snake_case dari flag `actions` layar. */
function actionsToApi(actions: QueueItemActions): ApiQueueItemActions {
  return {
    create_attempt: actions.createAttempt,
    start: actions.start,
    stop: actions.stop,
    retry: actions.retry,
    undo: actions.undo,
    next_participant: actions.nextParticipant,
    skip: actions.skip,
    mark_dns: actions.markDns,
    undo_dns: actions.undoDns,
    disqualify: actions.disqualify,
    undo_disqualify: actions.undoDisqualify,
    reopen: actions.reopen,
  };
}

/** Pesan 409 per aksi bila data melarangnya (setelah kasus umum seperti "bukan gilirannya"). */
const ACTION_MESSAGE: Record<keyof QueueItemActions, string> = {
  createAttempt:
    "A new attempt needs no other attempt waiting or running, a saved time for the last attempt, and attempts left.",
  start: "Only a waiting attempt of the participant on turn can be started.",
  stop: "Only a running attempt can be stopped.",
  retry: "There is no waiting or running attempt to retry.",
  undo: "There is no finished attempt to undo.",
  nextParticipant:
    "Next participant needs at least one counted attempt and no attempt waiting or running.",
  skip: "A participant who already used an attempt cannot be skipped, and someone else must still be waiting.",
  markDns:
    "Did not start is only possible before any attempt is counted and while no attempt is running.",
  undoDns: "Only a participant marked as did not start can be undone.",
  disqualify: "This participant cannot be disqualified now.",
  undoDisqualify: "This participant is not disqualified.",
  reopen: "Only a participant who is done can be reopened.",
};

/** Aksi yang hanya untuk peserta yang sedang giliran (lihat `participantActions`). */
const ON_TURN_ACTIONS: (keyof QueueItemActions)[] = [
  "createAttempt",
  "start",
  "stop",
  "retry",
  "undo",
  "nextParticipant",
  "skip",
  "markDns",
];

/**
 * Memastikan DATA mengizinkan satu aksi (pemanggil dianggap boleh), kalau tidak 409 dengan
 * pesan yang paling spesifik. Dipanggil dari route aksi setelah cek hak (403).
 */
function requireAction(
  snapshot: Snapshot,
  row: Row,
  action: keyof QueueItemActions,
) {
  requireState(
    snapshot.open,
    409,
    "Only an upcoming or ongoing competition with a locked running order can run attempts.",
  );
  const flags = participantActions(ruleInputOf(snapshot, row, true, true));
  if (flags[action]) return;
  if (row.disqualified && action !== "undoDisqualify")
    throw new ApiError(409, "This participant is disqualified.");
  if (
    ON_TURN_ACTIONS.includes(action) &&
    snapshot.currentEntryUuid !== row.entryUuid
  )
    throw new ApiError(409, "It is not this participant's turn.");
  if (action === "createAttempt" && row.counted >= snapshot.rules.attempt_limit)
    throw new ApiError(
      409,
      `All ${snapshot.rules.attempt_limit} attempts are used; go to the next participant.`,
    );
  if (
    action === "createAttempt" &&
    snapshot.rows.some((r) => r.entryUuid !== row.entryUuid && r.hasActive)
  )
    throw new ApiError(
      409,
      "Another attempt is already waiting or running in this competition.",
    );
  if (ON_TURN_ACTIONS.includes(action) && isTerminalState(row.state))
    throw new ApiError(
      409,
      "This participant is already done, did not start or is disqualified.",
    );
  throw new ApiError(409, ACTION_MESSAGE[action]);
}

// ---------------------------------------------------------------------------
// Bentuk respons
// ---------------------------------------------------------------------------

/** Satu peserta menjadi bentuk API, lengkap dengan nama, attempt, waktu terbaik, dan `actions`. */
function itemRecord(
  snapshot: Snapshot,
  row: Row,
  user: MockUser,
): ApiQueueItem {
  const info = participantInfo(row.entryUuid);
  const flags = participantActions(
    ruleInputOf(
      snapshot,
      row,
      canRun(user, snapshot.competition),
      canPenalize(user, snapshot.competition),
    ),
  );
  return {
    round_entry_uuid: roundEntryUuidOf(row.entryUuid),
    entry_uuid: row.entryUuid,
    drawing_order: row.drawingOrder,
    queue_number: row.drawingOrder,
    queue_position: row.queuePosition,
    status: row.disqualified ? "DSQ" : row.roundEntry.status,
    state: row.state,
    pet_name: info.pet_name,
    pet_morph_name: info.pet_morph_name,
    owner_name: info.owner_name,
    bib_number: info.bib_number,
    attempts: row.attempts,
    attempts_counted: row.counted,
    best_time_ms: row.disqualified ? null : (row.best?.timeMs ?? null),
    best_attempt_number: row.disqualified ? null : (row.best?.number ?? null),
    best_rank: snapshot.ranks.get(row.entryUuid) ?? null,
    penalties: row.penalties,
    actions: actionsToApi(flags),
  };
}

/** Bentuk respons antrean (`GET /queue` dan `POST /queue/{entryUuid}/skip`). */
function queueRecord(competition: MockCompetition, user: MockUser): ApiQueue {
  const snapshot = snapshotOf(competition);
  const count = (state: QueueState) =>
    snapshot.rows.filter((r) => r.state === state).length;
  return {
    competition_uuid: competition.uuid,
    round_uuid: roundUuidOf(competition.uuid),
    drawing_status: snapshot.drawing ? "LOCKED" : "NOT_DRAWN",
    rules: snapshot.rules,
    current_entry_uuid: snapshot.currentEntryUuid,
    items: snapshot.rows.map((row) => itemRecord(snapshot, row, user)),
    summary: {
      total: snapshot.rows.length,
      not_started: count("NOT_STARTED"),
      in_progress: count("IN_PROGRESS"),
      done: count("DONE"),
      dns: count("DNS"),
      dq: count("DQ"),
    },
  };
}

/** Satu round entry menjadi bentuk API (`RoundEntryData`). */
function roundEntryRecord(snapshot: Snapshot, row: Row): ApiRoundEntry {
  return {
    uuid: roundEntryUuidOf(row.entryUuid),
    round_uuid: roundUuidOf(snapshot.competition.uuid),
    entry_uuid: row.entryUuid,
    drawing_order: row.drawingOrder,
    queue_number: row.drawingOrder,
    queue_position: row.queuePosition,
    status: row.disqualified ? "DSQ" : row.roundEntry.status,
    decision_reason: row.roundEntry.decision_reason,
  };
}

/** Snapshot dan baris dari attempt (untuk route attempt); competition dicari lewat entry-nya. */
function contextOfAttempt(attempt: ApiAttempt) {
  const competition = competitionOfQueuedEntry(attempt.entry_uuid);
  if (!competition) throw notFound("Round");
  const snapshot = snapshotOf(competition);
  return { competition, snapshot, row: rowOf(snapshot, attempt.entry_uuid) };
}

// ---------------------------------------------------------------------------
// Route: antrean dan Skip (MOCK ONLY)
// ---------------------------------------------------------------------------

/**
 * `GET /competitions/{uuid}/queue`. Butuh login dan hak melihat (terkait event + `scoring.view`,
 * atau boleh menjalankan). 404, 403, 422 (bukan Time trial). Undian belum di-lock mengembalikan
 * `drawing_status: NOT_DRAWN` dan `items: []`.
 */
export function getQueueRecord(
  user: MockUser,
  competitionUuid: string,
): ApiQueue {
  const competition = store.competitions.find(
    (c) => c.uuid === competitionUuid,
  );
  if (!competition) throw notFound("Competition");
  forbidUnless(canView(user, competition));
  requireTimeTrial(competition);
  return queueRecord(competition, user);
}

/** Satu peserta Time trial untuk klasemen akhir (diturunkan dari antrean). */
export type TimeTrialStanding = {
  entryUuid: string;
  /** FINISHED = punya waktu sah, DQ/DNS dari status peserta, DNF = sudah memakai attempt tanpa waktu sah. */
  status: "FINISHED" | "DNF" | "DQ" | "DNS";
  bestTimeMs: number | null;
  /** Peringkat waktu terbaik dari antrean; urutan ini yang dipakai klasemen. */
  bestRank: number | null;
  attemptsCounted: number;
};

/**
 * Klasemen Time trial untuk Results. Memakai snapshot antrean yang sama dengan layar Run supaya
 * peringkat tidak pernah berbeda. Peserta yang belum mulai (belum ada attempt yang dihitung)
 * belum masuk klasemen. Dipanggil dari `mock-results.ts`.
 */
export function timeTrialStandings(
  competition: MockCompetition,
): TimeTrialStanding[] {
  const snapshot = snapshotOf(competition);
  const standings: TimeTrialStanding[] = [];
  for (const row of snapshot.rows) {
    const bestTimeMs = row.disqualified ? null : (row.best?.timeMs ?? null);
    let status: TimeTrialStanding["status"] | null = null;
    if (row.state === "DQ") status = "DQ";
    else if (row.state === "DNS") status = "DNS";
    else if (bestTimeMs !== null) status = "FINISHED";
    else if (row.counted > 0) status = "DNF";
    if (status === null) continue;
    standings.push({
      entryUuid: row.entryUuid,
      status,
      bestTimeMs,
      bestRank: snapshot.ranks.get(row.entryUuid) ?? null,
      attemptsCounted: row.counted,
    });
  }
  return standings;
}

/**
 * `POST /competitions/{uuid}/queue/{entryUuid}/skip` ("Skip to next"). Urutan cek: 404, 403, 422
 * (bukan Time trial), 404 (peserta bukan di antrean), 409 (aturan `actions.skip`). Sukses: peserta
 * pindah ke akhir antrean tanpa memakai attempt atau status apa pun. Mengembalikan antrean terbaru.
 */
export function skipParticipantRecord(
  user: MockUser,
  competitionUuid: string,
  entryUuid: string,
): ApiQueue {
  const competition = store.competitions.find(
    (c) => c.uuid === competitionUuid,
  );
  if (!competition) throw notFound("Competition");
  forbidUnless(canRun(user, competition));
  requireTimeTrial(competition);
  const snapshot = snapshotOf(competition);
  const row = rowOf(snapshot, entryUuid);
  requireAction(snapshot, row, "skip");
  timetrialStore.skips[competitionUuid] = withSkipped(
    timetrialStore.skips[competitionUuid] ?? [],
    entryUuid,
  );
  return queueRecord(competition, user);
}

// ---------------------------------------------------------------------------
// Route: attempt
// ---------------------------------------------------------------------------

/**
 * `POST /rounds/{uuid}/attempts` (backend `AttemptService::create`). Urutan cek: 404 (ronde belum
 * ada), 403, 422 (bukan Time trial, isi body, entry bukan dari kompetisi ini, `heat_id` diisi,
 * `attempt_number` sudah dipakai: pesan disalin dari backend), 409 (keadaan: kompetisi tidak
 * berjalan, bukan giliran, attempt lain aktif, jatah habis, peserta sudah selesai). Membalas
 * attempt WAITING.
 */
export function createAttemptRecord(
  user: MockUser,
  roundUuid: string,
  body: Record<string, unknown> | undefined,
): ApiAttempt {
  const competition = competitionOfRound(roundUuid);
  forbidUnless(canRun(user, competition));
  requireTimeTrial(competition);
  const errors: Record<string, string[]> = {};
  const entryUuid = body?.entry_id;
  const entry = store.entries.find((e) => e.uuid === entryUuid);
  if (entryUuid === undefined || entryUuid === null || entryUuid === "")
    errors.entry_id = ["The entry id field is required."];
  else if (typeof entryUuid !== "string" || !entry)
    errors.entry_id = ["The selected entry id is invalid."];
  const attemptNumber = intField(body, "attempt_number", 1, errors, {
    required: true,
  });
  const heatId = body?.heat_id;
  if (heatId !== undefined && heatId !== null && heatId !== "")
    errors.heat_id = ["This heat does not belong to the given round."];
  if (Object.keys(errors).length > 0) invalid(errors);
  requireState(
    entry!.competition_uuid === competition.uuid,
    422,
    "This entry does not belong to the round's competition.",
  );
  const snapshot = snapshotOf(competition);
  const row = snapshot.rows.find((r) => r.entryUuid === entry!.uuid);
  requireState(
    row !== undefined,
    422,
    "This entry is not part of the running order.",
  );
  requireState(
    !row!.attempts.some((a) => a.attempt_number === attemptNumber),
    422,
    "This attempt_number already exists for this entry and round.",
  );
  requireAction(snapshot, row!, "createAttempt");
  const attempt: ApiAttempt = {
    uuid: nextUuid(),
    entry_uuid: entry!.uuid,
    round_uuid: roundUuid,
    heat_uuid: null,
    attempt_number: attemptNumber as number,
    started_at: null,
    stopped_at: null,
    status: "WAITING",
    timer_result: null,
    checkpoint_results: [],
  };
  timetrialStore.attempts.push(attempt);
  return attempt;
}

/** `GET /attempts/{uuid}`. 404, 403 (hak melihat). */
export function getAttemptRecord(
  user: MockUser,
  attemptUuid: string,
): ApiAttempt {
  const attempt = attemptOf(attemptUuid);
  const { competition } = contextOfAttempt(attempt);
  forbidUnless(canView(user, competition));
  return attempt;
}

/**
 * `POST /attempts/{uuid}/start` (backend `AttemptService::start`). 404, 403, 422 "Only a waiting
 * attempt can be started.", 409 (keadaan: kompetisi tidak berjalan atau attempt lain aktif).
 * Sukses: attempt RUNNING dengan `started_at`; round entry peserta menjadi IN_PROGRESS dan match
 * antrean IN_PROGRESS (efek samping kontrak ini; di backend asli langkah terpisah).
 */
export function startAttemptRecord(
  user: MockUser,
  attemptUuid: string,
): ApiAttempt {
  const attempt = attemptOf(attemptUuid);
  const { competition, snapshot, row } = contextOfAttempt(attempt);
  forbidUnless(canRun(user, competition));
  requireState(
    attempt.status === "WAITING",
    422,
    "Only a waiting attempt can be started.",
  );
  requireAction(snapshot, row, "start");
  attempt.status = "RUNNING";
  attempt.started_at = iso(new Date());
  if (row.roundEntry.status === "WAITING" || row.roundEntry.status === "CALLED")
    timetrialStore.roundEntries[row.entryUuid] = {
      ...row.roundEntry,
      status: "IN_PROGRESS",
    };
  const match = snapshot.drawing?.matches[0];
  if (match && match.status === "SCHEDULED") match.status = "IN_PROGRESS";
  return attempt;
}

/**
 * `POST /attempts/{uuid}/stop` (backend `AttemptService::stop`). 404, 403, 422 "Only a running
 * attempt can be stopped.", 409 (kompetisi tidak berjalan). Sukses: status FINISHED dengan
 * `stopped_at`. Waktunya BELUM tersimpan; itu langkah `timer-result` berikutnya.
 */
export function stopAttemptRecord(
  user: MockUser,
  attemptUuid: string,
): ApiAttempt {
  const attempt = attemptOf(attemptUuid);
  const { competition, snapshot } = contextOfAttempt(attempt);
  forbidUnless(canRun(user, competition));
  requireState(
    attempt.status === "RUNNING",
    422,
    "Only a running attempt can be stopped.",
  );
  requireState(
    snapshot.open,
    409,
    "Only an upcoming or ongoing competition can run attempts.",
  );
  attempt.status = "FINISHED";
  attempt.stopped_at = iso(new Date());
  return attempt;
}

/** Perpindahan status manual yang diizinkan (kontrak 14): dari status sekarang ke status baru. */
const MANUAL_TRANSITIONS: Partial<Record<AttemptStatus, readonly string[]>> = {
  WAITING: ["RETRY", "FALSE_START"],
  RUNNING: MANUAL_ATTEMPT_STATUSES,
  // Undo attempt yang sudah selesai: hanya RETRY.
  FINISHED: ["RETRY"],
  TIMEOUT: ["RETRY"],
  DNF: ["RETRY"],
  DSQ: ["RETRY"],
};

/**
 * `PATCH /attempts/{uuid}/status` (backend `AttemptService::overrideStatus`). Urutan cek: 404,
 * 403 (peran status), 422 (`status` wajib dan salah satu TIMEOUT, DNF, RETRY, FALSE_START, DSQ),
 * 409 (kompetisi tidak berjalan, perpindahan tidak diizinkan, peserta sudah DONE/DNS/DQ saat
 * undo). Perpindahan: WAITING -> RETRY atau FALSE_START (batal); RUNNING -> semua; attempt yang
 * sudah selesai -> hanya RETRY (undo); RETRY dan FALSE_START final. Mengulang status yang sama
 * mengembalikan attempt apa adanya (aman diulang). Dari RUNNING `stopped_at` diisi.
 */
export function updateAttemptStatusRecord(
  user: MockUser,
  attemptUuid: string,
  body: Record<string, unknown> | undefined,
): ApiAttempt {
  const attempt = attemptOf(attemptUuid);
  const { competition, snapshot, row } = contextOfAttempt(attempt);
  forbidUnless(canSetStatus(user, competition));
  const status = body?.status;
  if (status === undefined || status === null || status === "")
    invalid({ status: ["The status field is required."] });
  if (
    typeof status !== "string" ||
    !(MANUAL_ATTEMPT_STATUSES as readonly string[]).includes(status)
  )
    invalid({ status: ["The selected status is invalid."] });
  if (attempt.status === status) return attempt;
  requireState(
    snapshot.open,
    409,
    "Only an upcoming or ongoing competition can run attempts.",
  );
  requireState(
    (MANUAL_TRANSITIONS[attempt.status] ?? []).includes(status as string),
    409,
    `An attempt that is ${attempt.status} cannot change to ${status as string}.`,
  );
  const wasRunning = attempt.status === "RUNNING";
  if (!wasRunning && attempt.status !== "WAITING") {
    requireState(
      row.state === "NOT_STARTED" || row.state === "IN_PROGRESS",
      409,
      "Reopen the participant before undoing an attempt.",
    );
    requireState(
      !row.hasActive,
      409,
      "Finish or retry the waiting or running attempt first.",
    );
  }
  attempt.status = status as AttemptStatus;
  if (wasRunning) attempt.stopped_at = iso(new Date());
  return attempt;
}

/**
 * `POST /attempts/{uuid}/timer-result` (backend `TimerResultService::record`). Urutan cek: 404,
 * 403, 422 (body: `raw_duration_ms` wajib bilangan bulat >= 0, `penalty_ms` bilangan bulat >= 0
 * atau kosong, `finish_status` wajib dan harus FINISHED di versi ini), lalu IDEMPOTENSI: bila
 * `client_request_id` sama dengan hasil attempt ini, hasil lama dikembalikan tanpa menulis ulang
 * (usulan kontrak, dicek SEBELUM aturan lain). Lalu 409 (attempt belum di-stop), 422 "A timer
 * result has already been recorded for this attempt." (backend), 422 (waktu >= cut-off: harus
 * TIMEOUT). `raw_duration_ms` disimpan apa adanya dari jam klien; `final = raw + penalti`.
 */
export function recordTimerResultRecord(
  user: MockUser,
  attemptUuid: string,
  body: Record<string, unknown> | undefined,
): ApiTimerResult {
  const attempt = attemptOf(attemptUuid);
  const { competition, snapshot } = contextOfAttempt(attempt);
  forbidUnless(canRun(user, competition));
  const errors: Record<string, string[]> = {};
  const raw = intField(body, "raw_duration_ms", 0, errors, { required: true });
  const penalty = intField(body, "penalty_ms", 0, errors);
  const finishStatus = body?.finish_status;
  if (typeof finishStatus !== "string" || finishStatus === "")
    errors.finish_status = ["The finish status field is required."];
  else if (finishStatus.length > 30)
    errors.finish_status = [
      "The finish status field must not be greater than 30 characters.",
    ];
  else if (finishStatus !== "FINISHED")
    errors.finish_status = [
      "The finish status must be FINISHED; use the attempt status endpoint for TIMEOUT or DNF.",
    ];
  const requestId = body?.client_request_id;
  if (
    requestId !== undefined &&
    requestId !== null &&
    typeof requestId !== "string"
  )
    errors.client_request_id = [
      "The client request id field must be a string.",
    ];
  if (Object.keys(errors).length > 0) invalid(errors);

  if (
    typeof requestId === "string" &&
    requestId !== "" &&
    attempt.timer_result?.client_request_id === requestId
  )
    return attempt.timer_result;
  requireState(
    attempt.status === "FINISHED",
    409,
    "Stop the attempt before recording its time.",
  );
  requireState(
    attempt.timer_result === null,
    422,
    "A timer result has already been recorded for this attempt.",
  );
  requireState(
    snapshot.open,
    409,
    "Only an upcoming or ongoing competition can run attempts.",
  );
  requireState(
    !shouldTimeout(raw as number, snapshot.rules.cutoff_ms),
    422,
    "The duration reached the cut-off; record the attempt as TIMEOUT instead.",
  );
  const penaltyMs = penalty ?? 0;
  const result: ApiTimerResult = {
    uuid: nextUuid(),
    attempt_uuid: attempt.uuid,
    raw_duration_ms: raw as number,
    penalty_ms: penaltyMs,
    final_duration_ms: (raw as number) + penaltyMs,
    finish_status: "FINISHED",
    recorded_by_uuid: user.uuid,
    recorded_at: iso(new Date()),
    client_request_id:
      typeof requestId === "string" && requestId !== "" ? requestId : null,
  };
  attempt.timer_result = result;
  return result;
}

// ---------------------------------------------------------------------------
// Route: round entry
// ---------------------------------------------------------------------------

/**
 * `PATCH /round-entries/{uuid}` (backend `RoundEntryService::update`). Urutan cek: 404, 403, 422
 * (body; status selain WAITING, IN_PROGRESS, COMPLETED, DNS ditolak, diskualifikasi lewat penalti),
 * lalu mengulang status yang sama mengembalikan data apa adanya, lalu 409 (aturan `actions`):
 * COMPLETED = "Next participant", DNS = "Did not start", WAITING hanya dari DNS (undo), dan
 * IN_PROGRESS hanya dari COMPLETED (buka lagi). `decision_reason` boleh dikirim bersama.
 */
export function updateRoundEntryRecord(
  user: MockUser,
  roundEntryUuid: string,
  body: Record<string, unknown> | undefined,
): ApiRoundEntry {
  const entryUuid = entryUuidOfRoundEntry(roundEntryUuid);
  const competition = entryUuid ? competitionOfQueuedEntry(entryUuid) : null;
  if (!entryUuid || !competition) throw notFound("Round entry");
  forbidUnless(canRun(user, competition));
  const errors: Record<string, string[]> = {};
  const status = body?.status;
  if (status !== undefined) {
    if (typeof status !== "string")
      errors.status = ["The status field must be a string."];
    else if (!(ROUND_ENTRY_STATUSES as readonly string[]).includes(status))
      errors.status = ["The selected status is invalid."];
    else if (!["WAITING", "IN_PROGRESS", "COMPLETED", "DNS"].includes(status))
      errors.status = [
        "This version supports WAITING, IN_PROGRESS, COMPLETED and DNS only; use a penalty to disqualify.",
      ];
  }
  const reason = body?.decision_reason;
  if (reason !== undefined && reason !== null && typeof reason !== "string")
    errors.decision_reason = ["The decision reason field must be a string."];
  if (Object.keys(errors).length > 0) invalid(errors);

  const snapshot = snapshotOf(competition);
  const row = rowOf(snapshot, entryUuid);
  if (status !== undefined && status !== row.roundEntry.status) {
    if (status === "COMPLETED") requireAction(snapshot, row, "nextParticipant");
    else if (status === "DNS") requireAction(snapshot, row, "markDns");
    else if (status === "WAITING") requireAction(snapshot, row, "undoDns");
    else requireAction(snapshot, row, "reopen");
    timetrialStore.roundEntries[entryUuid] = {
      ...row.roundEntry,
      status: status as RoundEntryStatus,
    };
  }
  if (reason !== undefined)
    timetrialStore.roundEntries[entryUuid] = {
      ...roundEntryState(entryUuid),
      decision_reason: reason as string | null,
    };
  const fresh = snapshotOf(competition);
  return roundEntryRecord(fresh, rowOf(fresh, entryUuid));
}

// ---------------------------------------------------------------------------
// Route: penalti (Disqualify)
// ---------------------------------------------------------------------------

/**
 * `POST /entries/{uuid}/penalties` untuk peserta Time trial (backend `PenaltyService::create`;
 * mock-request memilih route ini bila entry ada di antrean Time trial). 404 (entry), 403 (peran
 * penalti), 422 (body; unit selain DISQUALIFICATION), 409 (aturan `actions.disqualify`). Efek
 * samping: attempt yang masih WAITING atau RUNNING menjadi DSQ (peserta keluar, attempt tidak
 * relevan lagi). Membalas penalti baru.
 */
export function createPenaltyRecord(
  user: MockUser,
  entryUuid: string,
  body: Record<string, unknown> | undefined,
): ApiPenalty {
  const competition = competitionOfQueuedEntry(entryUuid);
  if (!competition) throw notFound("Entry");
  forbidUnless(canPenalize(user, competition));
  const errors: Record<string, string[]> = {};
  const type = body?.penalty_type;
  if (typeof type !== "string" || type === "")
    errors.penalty_type = ["The penalty type field is required."];
  else if (type.length > 50)
    errors.penalty_type = [
      "The penalty type field must not be greater than 50 characters.",
    ];
  const value = body?.penalty_value;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (value === undefined || value === null || value === "")
    errors.penalty_value = ["The penalty value field is required."];
  else if (typeof numeric !== "number" || !Number.isFinite(numeric))
    errors.penalty_value = ["The penalty value field must be a number."];
  else if (numeric < 0)
    errors.penalty_value = ["The penalty value field must be at least 0."];
  const unit = body?.penalty_unit;
  if (unit === undefined || unit === null || unit === "")
    errors.penalty_unit = ["The penalty unit field is required."];
  else if (
    typeof unit !== "string" ||
    !(PENALTY_UNITS as readonly string[]).includes(unit)
  )
    errors.penalty_unit = ["The selected penalty unit is invalid."];
  const reason = body?.reason;
  if (typeof reason !== "string" || reason.trim() === "")
    errors.reason = ["The reason field is required."];
  if (Object.keys(errors).length > 0) invalid(errors);
  requireState(
    unit === "DISQUALIFICATION",
    422,
    "Only DISQUALIFICATION penalties are supported for time trials in this version.",
  );
  const snapshot = snapshotOf(competition);
  const row = rowOf(snapshot, entryUuid);
  requireAction(snapshot, row, "disqualify");
  const penalty: ApiPenalty = {
    uuid: nextUuid(),
    entry_uuid: entryUuid,
    attempt_uuid: null,
    penalty_type: type as string,
    penalty_value: (numeric as number).toFixed(2),
    penalty_unit: "DISQUALIFICATION",
    reason: (reason as string).trim(),
    issued_by_uuid: user.uuid,
    issued_at: iso(new Date()),
    status: "ACTIVE",
  };
  timetrialStore.penalties.push(penalty);
  // Attempt yang sedang menunggu atau berjalan ikut gugur.
  const live = row.attempts.find(
    (a) => a.status === "WAITING" || a.status === "RUNNING",
  );
  if (live) {
    live.status = "DSQ";
    live.stopped_at = iso(new Date());
  }
  return penalty;
}

/**
 * `POST /penalties/{uuid}/revoke` untuk penalti peserta Time trial (backend
 * `PenaltyService::revoke`). 404, 403, 422 sudah REVOKED, 409 (kompetisi tidak berjalan).
 * Attempt yang sempat gugur (DSQ) tidak dihidupkan lagi.
 */
export function revokePenaltyRecord(
  user: MockUser,
  penaltyUuid: string,
): ApiPenalty {
  const penalty = timetrialStore.penalties.find((p) => p.uuid === penaltyUuid);
  if (!penalty) throw notFound("Penalty");
  const competition = competitionOfQueuedEntry(penalty.entry_uuid);
  if (!competition) throw notFound("Penalty");
  forbidUnless(canPenalize(user, competition));
  requireState(
    penalty.status !== "REVOKED",
    422,
    "This penalty has already been revoked.",
  );
  requireState(
    snapshotOf(competition).open,
    409,
    "Only an upcoming or ongoing competition can run attempts.",
  );
  penalty.status = "REVOKED";
  return penalty;
}
