import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { DEFAULT_CUTOFF_MS } from "@/domains/matches/constants";
import { rankFinishes, type LaneRankInput } from "@/domains/matches/rank";
import {
  PENALTY_UNITS,
  STOP_REASONS,
  type ApiFinishCapture,
  type ApiHeatEntry,
  type ApiMatch,
  type ApiMatchActions,
  type ApiMatchLane,
  type ApiMatchLaneActions,
  type ApiMatchList,
  type ApiMatchListItem,
  type ApiPenalty,
  type ApiRaceSession,
  type CallStatus,
  type MatchRunStatus,
} from "@/domains/matches/types";
import { RESULT_STATUSES, type ResultStatus } from "@/domains/results/types";
import type { MatchStatus } from "@/domains/drawing/types";
import { competitionRuleStore } from "./mock-competitions";
import {
  drawingChangeListeners,
  drawingStore,
  findStoredMatch,
  resetDrawingStore,
  type StoredDrawing,
  type StoredMatch,
} from "./mock-drawing";
import { mockAccess } from "./mock-access";
import { callerFor, forbidUnless, hasPermission, iso } from "./mock-records";
import { findOrThrow, nextUuid, store } from "./mock-store";
import type { MockCompetition, MockUser } from "./mock-types";

/**
 * Backend palsu untuk Run Match (kontrak petpet-docs/_draft-runmatch.md, bagian 13).
 * Sebagian besar route sudah ada di petpet-service (heats/sessions, finishes, penalties,
 * heat-entries) dan bentuk responsnya SAMA PERSIS dengan `*Data::toArray`. Yang baru (mock dulu):
 * `GET /competitions/{uuid}/matches`, `GET /matches/{uuid}`, dan `POST /heats/{uuid}/confirm`.
 * Aturan (siapa boleh menjalankan, keadaan sesi, undo, Confirm atomik) hidup di sini; layar hanya
 * membaca `actions`. Match berasal dari drawing terkunci (mock-drawing.ts): satu match = satu heat,
 * satu lane = satu `heat_entries`.
 *
 * Kode status: 401 tanpa login, 403 bukan hak pemanggil, 404 tidak ada, 422 isi request atau aturan
 * yang SUDAH ada di backend (pesannya disalin), 409 aturan keadaan yang DITAMBAHKAN kontrak ini
 * (backend asli belum memeriksanya).
 */

/** Sesi tersimpan: bentuk API tanpa daftar capture (capture disimpan terpisah, seperti tabelnya). */
type StoredSession = Omit<ApiRaceSession, "finish_captures">;

/** Data lane yang bisa berubah selama match, dikunci menurut uuid entry (satu entry = satu heat). */
type StoredHeatEntry = {
  call_status: CallStatus;
  completed_time_ms: number | null;
  position: number | null;
};

type StoredHeatTimes = {
  started_at: string | null;
  finished_at: string | null;
};

export const matchStore: {
  sessions: StoredSession[];
  captures: ApiFinishCapture[];
  penalties: ApiPenalty[];
  heatEntries: Record<string, StoredHeatEntry>;
  heatTimes: Record<string, StoredHeatTimes>;
} = {
  sessions: [],
  captures: [],
  penalties: [],
  heatEntries: {},
  heatTimes: {},
};

/**
 * Membuang data match. `null` = semua. Untuk satu kompetisi: sesi, capture, penalti, dan data lane
 * dari heat drawing-nya. Dipanggil dari `drawingChangeListeners` SEBELUM drawing dihapus.
 */
function purgeMatchState(competitionUuid: string | null) {
  if (competitionUuid === null) {
    matchStore.sessions = [];
    matchStore.captures = [];
    matchStore.penalties = [];
    matchStore.heatEntries = {};
    matchStore.heatTimes = {};
    return;
  }
  const matches = drawingStore.drawings[competitionUuid]?.matches ?? [];
  const heatUuids = new Set(matches.map((m) => m.uuid));
  const entryUuids = new Set(matches.flatMap((m) => m.entry_uuids));
  const sessionUuids = new Set(
    matchStore.sessions
      .filter((s) => heatUuids.has(s.heat_uuid))
      .map((s) => s.uuid),
  );
  matchStore.sessions = matchStore.sessions.filter(
    (s) => !sessionUuids.has(s.uuid),
  );
  matchStore.captures = matchStore.captures.filter(
    (c) => !sessionUuids.has(c.race_session_uuid),
  );
  matchStore.penalties = matchStore.penalties.filter(
    (p) => !entryUuids.has(p.entry_uuid),
  );
  for (const uuid of entryUuids) delete matchStore.heatEntries[uuid];
  for (const uuid of heatUuids) delete matchStore.heatTimes[uuid];
}

drawingChangeListeners.push(purgeMatchState);

/** Mengembalikan data match ke seed (kosong, semua match NOT_STARTED). Dipanggil dari tes. */
export function resetMatchStore() {
  purgeMatchState(null);
  // Status heat tersimpan di drawing; reset drawing mengembalikannya ke SCHEDULED.
  resetDrawingStore();
}

// ---------------------------------------------------------------------------
// Aturan akses
// ---------------------------------------------------------------------------

/**
 * Peran penugasan yang boleh menjalankan match. Backend sekarang lebih sempit (sesi: TIMER_OPERATOR
 * dan MARSHAL; finish: TIMER_OPERATOR dan HEAD_JUDGE; heat-entry: MARSHAL dan TIMER_OPERATOR) dan
 * tidak menyertakan EVENT_MANAGER atau COMPETITION_PIC; kontrak melebarkannya (celah di dokumen).
 */
const RUN_ROLES = [
  "EVENT_MANAGER",
  "COMPETITION_PIC",
  "TIMER_OPERATOR",
  "MARSHAL",
] as const;

/** Peran yang boleh memberi dan mencabut penalti (Disqualify): peran jalan ditambah juri. */
const PENALTY_ROLES = [...RUN_ROLES, "JUDGE", "HEAD_JUDGE"] as const;

/**
 * Meniru `ChecksStaffAssignment::requireStaffAccess` backend: super admin, OWNER atau ADMIN
 * organisasi pemilik event, atau penugasan aktif dengan peran yang diminta pada kompetisi itu
 * (atau pada seluruh event). Dipanggil dari `canRun` dan `canPenalize`.
 */
function hasStaffAccess(
  user: MockUser,
  competition: MockCompetition,
  roles: readonly string[],
): boolean {
  const access = mockAccess(user);
  if (access.roles.some((r) => r.code === "SUPER_ADMIN")) return true;
  const event = store.events.find((e) => e.uuid === competition.event_uuid);
  const member = access.organizations.find(
    (o) => o.uuid === event?.organization_uuid,
  );
  if (member && ["OWNER", "ADMIN"].includes(member.member_role)) return true;
  return access.staff_assignments.some(
    (a) =>
      roles.includes(a.assignment_role) &&
      a.event_uuid === competition.event_uuid &&
      (a.competition_uuid === null || a.competition_uuid === competition.uuid),
  );
}

const canRun = (user: MockUser, competition: MockCompetition) =>
  hasStaffAccess(user, competition, RUN_ROLES);

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

/** Hanya tipe RACE punya match; tipe lain 422. */
function requireRace(competition: MockCompetition) {
  const type = store.competitionTypes.find(
    (t) => t.uuid === competition.competition_type_uuid,
  );
  if (type?.code !== "RACE")
    throw new ApiError(
      422,
      "Matches are not available for this competition type.",
    );
}

// ---------------------------------------------------------------------------
// Pencarian data
// ---------------------------------------------------------------------------

/** Satu match yang ditemukan beserta kompetisi dan drawing-nya. */
type HeatRef = {
  competition: MockCompetition;
  drawing: StoredDrawing;
  match: StoredMatch;
};

const notFound = (label: string) => new ApiError(404, `${label} not found.`);

/** Mencari heat menurut uuid; 404 bila tidak ada di drawing mana pun. */
function heatRef(heatUuid: string): HeatRef {
  const found = findStoredMatch(heatUuid);
  if (!found) throw notFound("Heat");
  const competition = findOrThrow(
    store.competitions,
    found.competitionUuid,
    "Competition",
  );
  return { competition, drawing: found.drawing, match: found.match };
}

/** Mencari heat yang memuat satu entry; null bila entry tidak ada di drawing terkunci. */
function heatRefOfEntry(entryUuid: string): HeatRef | null {
  for (const [competitionUuid, drawing] of Object.entries(
    drawingStore.drawings,
  )) {
    const match = drawing.matches.find((m) =>
      m.entry_uuids.includes(entryUuid),
    );
    if (match) {
      const competition = findOrThrow(
        store.competitions,
        competitionUuid,
        "Competition",
      );
      return { competition, drawing, match };
    }
  }
  return null;
}

const sessionOf = (uuid: string): StoredSession => {
  const session = matchStore.sessions.find((s) => s.uuid === uuid);
  if (!session) throw notFound("Race session");
  return session;
};

const captureOf = (uuid: string): ApiFinishCapture => {
  const capture = matchStore.captures.find((c) => c.uuid === uuid);
  if (!capture) throw notFound("Finish capture");
  return capture;
};

/** Semua sesi satu heat, urut menurut nomor sesi. */
function sessionsOf(heatUuid: string): StoredSession[] {
  return matchStore.sessions
    .filter((s) => s.heat_uuid === heatUuid)
    .sort((a, b) => a.session_number - b.session_number);
}

/** Sesi yang berlaku: nomor tertinggi yang belum REMATCHED; null bila belum ada. */
function currentSessionOf(heatUuid: string): StoredSession | null {
  const live = sessionsOf(heatUuid).filter((s) => s.status !== "REMATCHED");
  return live.length > 0 ? live[live.length - 1] : null;
}

const capturesOf = (sessionUuid: string): ApiFinishCapture[] =>
  matchStore.captures
    .filter((c) => c.race_session_uuid === sessionUuid)
    .sort((a, b) => a.finish_order - b.finish_order);

const penaltiesOf = (entryUuid: string): ApiPenalty[] =>
  matchStore.penalties
    .filter((p) => p.entry_uuid === entryUuid)
    .sort((a, b) => a.issued_at.localeCompare(b.issued_at));

const activeDisqualification = (entryUuid: string): ApiPenalty | null =>
  penaltiesOf(entryUuid).find(
    (p) => p.penalty_unit === "DISQUALIFICATION" && p.status === "ACTIVE",
  ) ?? null;

/** Finish aktif satu entry di satu sesi: capture ASSIGNED ke entry itu. */
const activeFinish = (
  session: StoredSession | null,
  entryUuid: string,
): ApiFinishCapture | null =>
  session
    ? (capturesOf(session.uuid).find(
        (c) =>
          c.assignment_status === "ASSIGNED" &&
          c.assigned_entry_uuid === entryUuid,
      ) ?? null)
    : null;

const laneState = (entryUuid: string): StoredHeatEntry =>
  matchStore.heatEntries[entryUuid] ?? {
    call_status: "WAITING",
    completed_time_ms: null,
    position: null,
  };

const heatEntryUuidOf = (entryUuid: string) => `he-${entryUuid}`;

/** Kebalikan `heatEntryUuidOf`: uuid entry, atau null bila bukan uuid heat entry mock. */
const entryUuidOfHeatEntry = (heatEntryUuid: string): string | null =>
  heatEntryUuid.startsWith("he-") ? heatEntryUuid.slice(3) : null;

// ---------------------------------------------------------------------------
// Flag actions (aturan keadaan)
// ---------------------------------------------------------------------------

const RUNNING_OR_STOPPED = ["RUNNING", "FINISHED", "CUTOFF"];
const RUNNABLE_COMPETITION_STATUSES = ["SCHEDULED", "ONGOING"];

/** Keadaan yang dibutuhkan aturan: dihitung sekali per match. */
type RuleContext = {
  competition: MockCompetition;
  heatStatus: MatchStatus;
  session: StoredSession | null;
  /** Pemanggil boleh menjalankan match. Tes "data mengizinkan?" memakai true. */
  runner: boolean;
  /** Pemanggil boleh memberi penalti. */
  penalizer: boolean;
};

/** Match masih bisa diubah: belum DONE dan kompetisinya SCHEDULED atau ONGOING. */
const isOpen = (ctx: RuleContext) =>
  ctx.heatStatus !== "COMPLETED" &&
  RUNNABLE_COMPETITION_STATUSES.includes(ctx.competition.status);

/**
 * Flag `actions` match. Aturan dari kontrak 13 bagian 13:
 * - `create_session`: belum ada sesi (atau sesi terakhir CANCELLED).
 * - `start`/`finish`/`stop`: sesi READY / RUNNING / RUNNING.
 * - `rematch`: sesi sudah mulai (RUNNING, FINISHED, CUTOFF), selama belum Confirm.
 * - `disqualify`: sama dengan rematch, plus hak penalti.
 * - `confirm`: heat IN_PROGRESS dan sesi FINISHED atau CUTOFF.
 * Dipanggil dari `matchRecord` dan semua route aksi (dengan runner/penalizer true untuk 409 vs 403).
 */
export function matchActions(ctx: RuleContext): ApiMatchActions {
  const open = ctx.runner && isOpen(ctx);
  const status = ctx.session?.status ?? null;
  const started = status !== null && RUNNING_OR_STOPPED.includes(status);
  return {
    create_session: open && (status === null || status === "CANCELLED"),
    start: open && status === "READY",
    finish: open && status === "RUNNING",
    stop: open && status === "RUNNING",
    rematch: open && started,
    mark_dns: open,
    disqualify: ctx.penalizer && isOpen(ctx) && started,
    confirm:
      open &&
      ctx.heatStatus === "IN_PROGRESS" &&
      (status === "FINISHED" || status === "CUTOFF"),
  };
}

/**
 * Flag `actions` satu lane. `finish` hanya bila sesi RUNNING, lane menunggu (belum DNS), belum
 * finish, dan tidak didiskualifikasi. `undo_finish` bila lane punya finish aktif dan sesi sudah
 * mulai. `mark_dns` bila lane menunggu tanpa finish dan bukan DQ; `undo_dns` bila sedang DNS.
 * `disqualify` hanya setelah sesi mulai; `undo_disqualify` bila ada DQ aktif.
 */
export function laneActions(
  ctx: RuleContext,
  entryUuid: string,
): ApiMatchLaneActions {
  const open = ctx.runner && isOpen(ctx);
  const status = ctx.session?.status ?? null;
  const running = status === "RUNNING";
  const started = status !== null && RUNNING_OR_STOPPED.includes(status);
  const waiting = laneState(entryUuid).call_status === "WAITING";
  const finish = activeFinish(ctx.session, entryUuid);
  const dq = activeDisqualification(entryUuid);
  const penaltyOpen = ctx.penalizer && isOpen(ctx);
  return {
    finish: open && running && waiting && finish === null && dq === null,
    undo_finish: open && finish !== null && started,
    mark_dns: open && waiting && finish === null && dq === null,
    undo_dns: open && laneState(entryUuid).call_status === "DNS",
    disqualify: penaltyOpen && started && waiting && dq === null,
    undo_disqualify: penaltyOpen && dq !== null,
  };
}

/** Konteks aturan untuk satu heat dan pemanggil. */
function contextFor(
  ref: HeatRef,
  runner: boolean,
  penalizer: boolean,
): RuleContext {
  return {
    competition: ref.competition,
    heatStatus: ref.match.status,
    session: currentSessionOf(ref.match.uuid),
    runner,
    penalizer,
  };
}

/** Konteks "pemanggil boleh semuanya": hanya keadaan data yang menentukan. Untuk 409 vs 403. */
const dataContext = (ref: HeatRef) => contextFor(ref, true, true);

/** Melempar `status` dengan `message` bila `allowed` salah. */
function requireState(allowed: boolean, status: 409 | 422, message: string) {
  if (!allowed) throw new ApiError(status, message);
}

// ---------------------------------------------------------------------------
// Bentuk respons
// ---------------------------------------------------------------------------

const fullName = (user: {
  first_name: string;
  last_name?: string;
  username: string;
}) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

/** Status daftar/layar dari status heat. */
const runStatusOf = (heatStatus: MatchStatus): MatchRunStatus =>
  heatStatus === "COMPLETED"
    ? "DONE"
    : heatStatus === "IN_PROGRESS"
      ? "RUNNING"
      : "NOT_STARTED";

/** Satu sesi tersimpan menjadi bentuk API (`RaceSessionData`) lengkap dengan capture. */
function sessionRecord(session: StoredSession): ApiRaceSession {
  return { ...session, finish_captures: capturesOf(session.uuid) };
}

/** Satu baris `heat_entries` (`HeatEntryData`) untuk satu entry dalam heat. */
function heatEntryRecord(ref: HeatRef, entryUuid: string): ApiHeatEntry {
  const lane = ref.match.entry_uuids.indexOf(entryUuid) + 1;
  const state = laneState(entryUuid);
  return {
    uuid: heatEntryUuidOf(entryUuid),
    heat_uuid: ref.match.uuid,
    entry_uuid: entryUuid,
    lane_number: lane,
    start_order: lane,
    call_status: state.call_status,
    distance_to_finish: null,
    completed_time_ms: state.completed_time_ms,
    position: state.position,
    cot_flag: false,
  };
}

/** Nama hewan, morph, pemilik, dan bib satu entry dari pets/users yang sudah ada. */
function participantInfo(entryUuid: string) {
  const entry = findOrThrow(store.entries, entryUuid, "Entry");
  const pet = store.pets.find((p) => p.uuid === entry.pet_uuid);
  const morph = store.petMorphs.find((m) => m.uuid === pet?.morph_uuid);
  const owner = store.users.find((u) => u.uuid === entry.owner_uuid);
  return {
    pet_name: pet?.name ?? null,
    pet_morph_name: morph?.name ?? null,
    owner_name: owner ? fullName(owner) : "Unknown owner",
    bib_number: entry.bib_number,
  };
}

/**
 * Nilai awal pembuatan sesi dari rule aktif kompetisi (yang `is_active`, kalau tidak ada versi
 * tertinggi): hitung mundur 0 bila dimatikan, cut-off = `time_limit_ms` atau `DEFAULT_CUTOFF_MS`.
 */
export function sessionDefaults(competitionUuid: string) {
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
    countdown_seconds: rule
      ? rule.countdown_enabled
        ? rule.countdown_seconds
        : 0
      : 3,
    cutoff_time_ms: rule?.time_limit_ms ?? DEFAULT_CUTOFF_MS,
  };
}

/** Bentuk respons detail match (`GET /matches/{uuid}` dan `POST /heats/{uuid}/confirm`). */
function matchRecord(ref: HeatRef, user: MockUser): ApiMatch {
  const ctx = contextFor(
    ref,
    canRun(user, ref.competition),
    canPenalize(user, ref.competition),
  );
  const times = matchStore.heatTimes[ref.match.uuid];
  const lanes: ApiMatchLane[] = ref.match.entry_uuids.map((entryUuid) => ({
    ...heatEntryRecord(ref, entryUuid),
    ...participantInfo(entryUuid),
    penalties: penaltiesOf(entryUuid),
    actions: laneActions(ctx, entryUuid),
  }));
  return {
    uuid: ref.match.uuid,
    competition_uuid: ref.competition.uuid,
    round_uuid: `round-${ref.competition.uuid}-1`,
    match_number: ref.match.match_number,
    total_matches: ref.drawing.matches.length,
    purpose: "NORMAL",
    arena_name: ref.competition.arena_name ?? null,
    scheduled_at: null,
    started_at: times?.started_at ?? null,
    finished_at: times?.finished_at ?? null,
    heat_status: ref.match.status,
    status: runStatusOf(ref.match.status),
    session_defaults: sessionDefaults(ref.competition.uuid),
    lanes,
    sessions: sessionsOf(ref.match.uuid).map(sessionRecord),
    current_session_uuid: ctx.session?.uuid ?? null,
    actions: matchActions(ctx),
  };
}

// ---------------------------------------------------------------------------
// Validasi body
// ---------------------------------------------------------------------------

/** Melempar 422 dengan pesan per field, seperti validasi Laravel. */
function invalid(errors: Record<string, string[]>): never {
  throw new ApiError(422, Object.values(errors).flat().join(" "), errors);
}

/** Bilangan bulat dari angka atau string angka (seperti aturan `integer` Laravel); null bila bukan. */
function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim()))
    return Number(value);
  return null;
}

/** Aturan field bilangan bulat: mengembalikan nilainya atau menambah pesan ke `errors`. */
function intField(
  body: Record<string, unknown> | undefined,
  field: string,
  min: number,
  errors: Record<string, string[]>,
  options: { required?: boolean } = {},
): number | null {
  const label = field.replace(/_/g, " ");
  const raw = body?.[field];
  if (raw === undefined || raw === null || raw === "") {
    if (options.required) errors[field] = [`The ${label} field is required.`];
    return null;
  }
  const value = toInt(raw);
  if (value === null) {
    errors[field] = [`The ${label} field must be an integer.`];
    return null;
  }
  if (value < min) {
    errors[field] = [`The ${label} field must be at least ${min}.`];
    return null;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Route: daftar dan detail
// ---------------------------------------------------------------------------

/**
 * `GET /competitions/{uuid}/matches`. Butuh login, hak melihat (terkait event + `scoring.view`, atau
 * boleh menjalankan). Tipe selain Race 422. Drawing belum di-lock mengembalikan `items: []`.
 */
export function listMatchesRecord(
  user: MockUser,
  competitionUuid: string,
): ApiMatchList {
  const competition = store.competitions.find(
    (c) => c.uuid === competitionUuid,
  );
  if (!competition) throw notFound("Competition");
  forbidUnless(canView(user, competition));
  requireRace(competition);
  const drawing = drawingStore.drawings[competitionUuid];
  const items: ApiMatchListItem[] = (drawing?.matches ?? []).map((match) => {
    const current = currentSessionOf(match.uuid);
    return {
      uuid: match.uuid,
      match_number: match.match_number,
      status: runStatusOf(match.status),
      heat_status: match.status,
      planned_lanes: match.entry_uuids.map((entryUuid, index) => {
        const info = participantInfo(entryUuid);
        return {
          lane_number: index + 1,
          entry_uuid: entryUuid,
          pet_name: info.pet_name,
          owner_name: info.owner_name,
          bib_number: info.bib_number,
        };
      }),
      current_session: current
        ? {
            uuid: current.uuid,
            session_number: current.session_number,
            status: current.status,
          }
        : null,
      session_count: sessionsOf(match.uuid).length,
    };
  });
  return {
    competition_uuid: competitionUuid,
    drawing_status: drawing ? "LOCKED" : "NOT_DRAWN",
    items,
  };
}

/** `GET /matches/{uuid}` (uuid heat). 404, 403 (hak melihat), 422 (bukan Race). */
export function getMatchRecord(user: MockUser, heatUuid: string): ApiMatch {
  const ref = heatRef(heatUuid);
  forbidUnless(canView(user, ref.competition));
  requireRace(ref.competition);
  return matchRecord(ref, user);
}

// ---------------------------------------------------------------------------
// Route: sesi
// ---------------------------------------------------------------------------

/** Sesi yang boleh dilihat/diubah beserta heat-nya; 404 bila tidak ada. */
function sessionRef(sessionUuid: string) {
  const session = sessionOf(sessionUuid);
  return { session, ref: heatRef(session.heat_uuid) };
}

/**
 * `POST /heats/{uuid}/sessions` (backend `RaceSessionService::create`). Urutan cek: 404, 403, 422
 * (bukan Race, isi body), 409 (match sudah DONE, kompetisi tidak berjalan, sudah punya sesi tanpa
 * rematch, rematch bukan dari sesi yang berlaku atau belum mulai), 422 (nomor sesi sudah dipakai,
 * `rematch_of_session_id` salah). Rematch menandai sesi lama REMATCHED dalam langkah yang sama,
 * jadi hanya satu sesi aktif per match.
 */
export function createSessionRecord(
  user: MockUser,
  heatUuid: string,
  body: Record<string, unknown> | undefined,
): ApiRaceSession {
  const ref = heatRef(heatUuid);
  forbidUnless(canRun(user, ref.competition));
  requireRace(ref.competition);
  const errors: Record<string, string[]> = {};
  const sessionNumber = intField(body, "session_number", 1, errors, {
    required: true,
  });
  const countdown = intField(body, "countdown_seconds", 0, errors);
  const cutoff = intField(body, "cutoff_time_ms", 0, errors, {
    required: true,
  });
  const rematchRaw = body?.rematch_of_session_id;
  if (rematchRaw !== undefined && rematchRaw !== null && rematchRaw !== "") {
    if (
      typeof rematchRaw !== "string" ||
      !matchStore.sessions.some((s) => s.uuid === rematchRaw)
    )
      errors.rematch_of_session_id = [
        "The selected rematch of session id is invalid.",
      ];
  }
  if (Object.keys(errors).length > 0) invalid(errors);

  const ctx = dataContext(ref);
  requireState(
    ref.match.status !== "COMPLETED",
    409,
    "This match is already confirmed.",
  );
  requireState(
    RUNNABLE_COMPETITION_STATUSES.includes(ref.competition.status),
    409,
    "Only an upcoming or ongoing competition can run matches.",
  );
  requireState(
    !sessionsOf(heatUuid).some((s) => s.session_number === sessionNumber),
    422,
    "This session_number already exists for this heat.",
  );
  const current = ctx.session;
  const rematchOf =
    typeof rematchRaw === "string" && rematchRaw !== ""
      ? sessionOf(rematchRaw)
      : null;
  if (rematchOf) {
    requireState(
      rematchOf.heat_uuid === heatUuid,
      422,
      "rematch_of_session_id must belong to the same heat.",
    );
    requireState(
      current?.uuid === rematchOf.uuid && matchActions(ctx).rematch === true,
      409,
      "Only the current session of a started match can be rematched.",
    );
  } else {
    requireState(
      current === null || current.status === "CANCELLED",
      409,
      "This match already has a session; use rematch to run it again.",
    );
  }
  const session: StoredSession = {
    uuid: nextUuid(),
    heat_uuid: heatUuid,
    session_number: sessionNumber as number,
    rematch_of_session_uuid: rematchOf?.uuid ?? null,
    countdown_seconds: countdown ?? 3,
    cutoff_time_ms: cutoff as number,
    started_at: null,
    stopped_at: null,
    stop_reason: null,
    status: "READY",
  };
  matchStore.sessions.push(session);
  if (rematchOf) rematchOf.status = "REMATCHED";
  return sessionRecord(session);
}

/**
 * `POST /sessions/{uuid}/start` (backend `RaceSessionService::start`). 404, 403, 422 "Only a ready
 * session can be started.", 409 (match DONE atau kompetisi tidak berjalan). Sukses: sesi RUNNING
 * dengan `started_at`, dan heat SCHEDULED menjadi IN_PROGRESS (efek samping kontrak ini; di backend
 * asli ini langkah terpisah `POST /heats/{uuid}/start`).
 */
export function startSessionRecord(
  user: MockUser,
  sessionUuid: string,
): ApiRaceSession {
  const { session, ref } = sessionRef(sessionUuid);
  forbidUnless(canRun(user, ref.competition));
  requireState(
    session.status === "READY",
    422,
    "Only a ready session can be started.",
  );
  requireState(
    isOpen(dataContext(ref)),
    409,
    "This match can no longer be run.",
  );
  const now = iso(new Date());
  session.status = "RUNNING";
  session.started_at = now;
  if (ref.match.status === "SCHEDULED") {
    ref.match.status = "IN_PROGRESS";
    matchStore.heatTimes[ref.match.uuid] = {
      started_at: now,
      finished_at: null,
    };
  }
  return sessionRecord(session);
}

/**
 * `POST /sessions/{uuid}/stop` (backend `RaceSessionService::stop`). 404, 403, 422 (`stop_reason`
 * salah, atau sesi bukan RUNNING). CUTOFF menjadi status CUTOFF, alasan lain FINISHED.
 */
export function stopSessionRecord(
  user: MockUser,
  sessionUuid: string,
  body: Record<string, unknown> | undefined,
): ApiRaceSession {
  const { session, ref } = sessionRef(sessionUuid);
  forbidUnless(canRun(user, ref.competition));
  const reason = body?.stop_reason;
  if (reason === undefined || reason === null || reason === "")
    invalid({ stop_reason: ["The stop reason field is required."] });
  if (
    typeof reason !== "string" ||
    !(STOP_REASONS as readonly string[]).includes(reason)
  )
    invalid({ stop_reason: ["The selected stop reason is invalid."] });
  requireState(
    session.status === "RUNNING",
    422,
    "Only a running session can be stopped.",
  );
  session.status = reason === "CUTOFF" ? "CUTOFF" : "FINISHED";
  session.stopped_at = iso(new Date());
  session.stop_reason = reason as StoredSession["stop_reason"];
  return sessionRecord(session);
}

// ---------------------------------------------------------------------------
// Route: finish capture
// ---------------------------------------------------------------------------

/**
 * `POST /sessions/{uuid}/finishes` (backend `FinishCaptureService::capture`). 404, 403, 422 (body),
 * 409 (sesi bukan RUNNING; aturan tambahan), 422 `finish_order` sudah dipakai. Bila
 * `client_request_id` sudah pernah dipakai di sesi ini, capture lama dikembalikan tanpa membuat
 * yang baru (idempotensi, usulan kontrak) dan dicek SEBELUM keadaan sesi.
 * `captured_time_ms` disimpan apa adanya dari jam klien.
 */
export function captureFinishRecord(
  user: MockUser,
  sessionUuid: string,
  body: Record<string, unknown> | undefined,
): ApiFinishCapture {
  const { session, ref } = sessionRef(sessionUuid);
  forbidUnless(canRun(user, ref.competition));
  const errors: Record<string, string[]> = {};
  const finishOrder = intField(body, "finish_order", 1, errors, {
    required: true,
  });
  const capturedTime = intField(body, "captured_time_ms", 0, errors, {
    required: true,
  });
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

  if (typeof requestId === "string" && requestId !== "") {
    const existing = matchStore.captures.find(
      (c) =>
        c.race_session_uuid === sessionUuid &&
        c.client_request_id === requestId,
    );
    if (existing) return existing;
  }
  requireState(
    session.status === "RUNNING",
    409,
    "Finishes can only be captured while the session is running.",
  );
  requireState(
    !matchStore.captures.some(
      (c) =>
        c.race_session_uuid === sessionUuid && c.finish_order === finishOrder,
    ),
    422,
    "This finish_order has already been captured for this session.",
  );
  const capture: ApiFinishCapture = {
    uuid: nextUuid(),
    race_session_uuid: sessionUuid,
    finish_order: finishOrder as number,
    captured_time_ms: capturedTime as number,
    assigned_entry_uuid: null,
    captured_by_uuid: user.uuid,
    captured_at: iso(new Date()),
    assignment_status: "UNASSIGNED",
    assigned_by_uuid: null,
    assigned_at: null,
    client_request_id:
      typeof requestId === "string" && requestId !== "" ? requestId : null,
  };
  matchStore.captures.push(capture);
  return capture;
}

/** Capture beserta sesi dan heat-nya; 404 bila tidak ada. */
function captureRef(captureUuid: string) {
  const capture = captureOf(captureUuid);
  return { capture, ...sessionRef(capture.race_session_uuid) };
}

/**
 * `PATCH /finishes/{uuid}/assign` (backend `FinishCaptureService::assign`). 404, 403, 422 (body,
 * entry tidak ada, capture sudah VOID, entry bukan dari kompetisi ini, entry sudah punya finish di
 * sesi ini, atau entry bukan lane match ini), 409 (match DONE, sesi sudah REMATCHED, lane DNS atau
 * DQ). Mengulang assign yang sama (capture sudah ASSIGNED ke entry yang sama) mengembalikan capture
 * apa adanya, supaya retry setelah jaringan putus aman.
 */
export function assignFinishRecord(
  user: MockUser,
  captureUuid: string,
  body: Record<string, unknown> | undefined,
): ApiFinishCapture {
  const { capture, session, ref } = captureRef(captureUuid);
  forbidUnless(canRun(user, ref.competition));
  const entryUuid = body?.assigned_entry_id;
  if (entryUuid === undefined || entryUuid === null || entryUuid === "")
    invalid({
      assigned_entry_id: ["The assigned entry id field is required."],
    });
  const entry = store.entries.find((e) => e.uuid === entryUuid);
  if (typeof entryUuid !== "string" || !entry)
    invalid({
      assigned_entry_id: ["The selected assigned entry id is invalid."],
    });
  const entryId = entryUuid as string;
  requireState(
    capture.assignment_status !== "VOID",
    422,
    "This finish capture has been voided and cannot be assigned.",
  );
  if (
    capture.assignment_status === "ASSIGNED" &&
    capture.assigned_entry_uuid === entryId
  )
    return capture;
  requireState(
    entry!.competition_uuid === ref.competition.uuid,
    422,
    "This entry does not belong to the finish capture's competition.",
  );
  requireState(
    ref.match.entry_uuids.includes(entryId),
    422,
    "This entry is not a lane of the finish capture's match.",
  );
  requireState(
    !matchStore.captures.some(
      (c) =>
        c.race_session_uuid === session.uuid &&
        c.uuid !== capture.uuid &&
        c.assigned_entry_uuid === entryId,
    ),
    422,
    "This entry is already assigned to a finish in this session.",
  );
  requireState(
    ref.match.status !== "COMPLETED",
    409,
    "This match is already confirmed.",
  );
  requireState(
    session.status !== "REMATCHED",
    409,
    "This session was replaced by a rematch.",
  );
  requireState(
    laneState(entryId).call_status === "WAITING",
    409,
    "A participant marked as did not start cannot finish.",
  );
  requireState(
    activeDisqualification(entryId) === null,
    409,
    "A disqualified participant cannot finish.",
  );
  capture.assigned_entry_uuid = entryId;
  capture.assignment_status = "ASSIGNED";
  capture.assigned_by_uuid = user.uuid;
  capture.assigned_at = iso(new Date());
  return capture;
}

/**
 * `POST /finishes/{uuid}/void` (backend `FinishCaptureService::void`, undo). 404, 403, 422 sudah
 * VOID, 409 (match sudah DONE atau sesi sudah REMATCHED). Entry yang dilepas boleh finish lagi
 * (capture baru dengan `finish_order` baru).
 */
export function voidFinishRecord(
  user: MockUser,
  captureUuid: string,
): ApiFinishCapture {
  const { capture, session, ref } = captureRef(captureUuid);
  forbidUnless(canRun(user, ref.competition));
  requireState(
    capture.assignment_status !== "VOID",
    422,
    "This finish capture has already been voided.",
  );
  requireState(
    ref.match.status !== "COMPLETED",
    409,
    "This match is already confirmed.",
  );
  requireState(
    session.status !== "REMATCHED",
    409,
    "This session was replaced by a rematch.",
  );
  capture.assignment_status = "VOID";
  capture.assigned_entry_uuid = null;
  capture.assigned_by_uuid = null;
  capture.assigned_at = null;
  return capture;
}

// ---------------------------------------------------------------------------
// Route: penalti dan heat entry
// ---------------------------------------------------------------------------

/**
 * `POST /entries/{uuid}/penalties` (backend `PenaltyService::create`). 404 (entry), 403 (peran
 * penalti), 422 (body; entry bukan lane match; P5a hanya menerima unit DISQUALIFICATION),
 * 409 (match DONE, sesi belum mulai, lane DNS, atau sudah didiskualifikasi). Membalas penalti baru.
 */
export function createPenaltyRecord(
  user: MockUser,
  entryUuid: string,
  body: Record<string, unknown> | undefined,
): ApiPenalty {
  const entry = store.entries.find((e) => e.uuid === entryUuid);
  if (!entry) throw notFound("Entry");
  const competition = findOrThrow(
    store.competitions,
    entry.competition_uuid,
    "Competition",
  );
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
  requireRace(competition);
  const ref = heatRefOfEntry(entryUuid);
  requireState(ref !== null, 422, "This entry is not part of a match.");
  requireState(
    unit === "DISQUALIFICATION",
    422,
    "Only DISQUALIFICATION penalties are supported for matches in this version.",
  );
  const context = dataContext(ref as HeatRef);
  requireState(
    (ref as HeatRef).match.status !== "COMPLETED",
    409,
    "This match is already confirmed.",
  );
  requireState(
    laneState(entryUuid).call_status === "WAITING",
    409,
    "A participant marked as did not start cannot be disqualified.",
  );
  requireState(
    activeDisqualification(entryUuid) === null,
    409,
    "This participant is already disqualified.",
  );
  requireState(
    matchActions(context).disqualify,
    409,
    "A participant can be disqualified once the match has started.",
  );
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
  matchStore.penalties.push(penalty);
  return penalty;
}

/**
 * `POST /penalties/{uuid}/revoke` (backend `PenaltyService::revoke`). 404, 403, 422 sudah REVOKED,
 * 409 match sudah DONE (hasil sudah tertulis).
 */
export function revokePenaltyRecord(
  user: MockUser,
  penaltyUuid: string,
): ApiPenalty {
  const penalty = matchStore.penalties.find((p) => p.uuid === penaltyUuid);
  if (!penalty) throw notFound("Penalty");
  const ref = heatRefOfEntry(penalty.entry_uuid);
  const entry = findOrThrow(store.entries, penalty.entry_uuid, "Entry");
  const competition = findOrThrow(
    store.competitions,
    entry.competition_uuid,
    "Competition",
  );
  forbidUnless(canPenalize(user, competition));
  requireState(
    penalty.status !== "REVOKED",
    422,
    "This penalty has already been revoked.",
  );
  requireState(
    ref === null || ref.match.status !== "COMPLETED",
    409,
    "This match is already confirmed.",
  );
  penalty.status = "REVOKED";
  return penalty;
}

/**
 * `PATCH /heat-entries/{uuid}` (backend `HeatEntryService::update`). Hanya `call_status` yang
 * dipakai kontrak ini (WAITING atau DNS). 404, 403, 422 (body; `position` dan `completed_time_ms`
 * ditolak karena hanya Confirm yang menulisnya), 409 (match DONE, lane punya finish aktif atau DQ).
 */
export function updateHeatEntryRecord(
  user: MockUser,
  heatEntryUuid: string,
  body: Record<string, unknown> | undefined,
): ApiHeatEntry {
  const entryUuid = entryUuidOfHeatEntry(heatEntryUuid);
  const ref = entryUuid ? heatRefOfEntry(entryUuid) : null;
  if (!entryUuid || !ref) throw notFound("Heat entry");
  forbidUnless(canRun(user, ref.competition));
  const errors: Record<string, string[]> = {};
  const status = body?.call_status;
  if (status !== undefined) {
    if (typeof status !== "string")
      errors.call_status = ["The call status field must be a string."];
    else if (status.length > 30)
      errors.call_status = [
        "The call status field must not be greater than 30 characters.",
      ];
    else if (status !== "WAITING" && status !== "DNS")
      errors.call_status = [
        "The call status must be WAITING or DNS in this version.",
      ];
  }
  for (const field of ["position", "completed_time_ms"]) {
    if (body?.[field] !== undefined)
      errors[field] = ["Results are written by confirming the match."];
  }
  if (Object.keys(errors).length > 0) invalid(errors);
  if (status !== undefined) {
    requireState(
      ref.match.status !== "COMPLETED",
      409,
      "This match is already confirmed.",
    );
    const session = currentSessionOf(ref.match.uuid);
    if (status === "DNS") {
      requireState(
        activeFinish(session, entryUuid) === null,
        409,
        "Undo the finish of this participant before marking it as did not start.",
      );
      requireState(
        activeDisqualification(entryUuid) === null,
        409,
        "A disqualified participant cannot be marked as did not start.",
      );
    }
    matchStore.heatEntries[entryUuid] = {
      ...laneState(entryUuid),
      call_status: status as CallStatus,
    };
  }
  return heatEntryRecord(ref, entryUuid);
}

// ---------------------------------------------------------------------------
// Route: confirm (baru, atomik)
// ---------------------------------------------------------------------------

/** Satu hasil lane yang sudah divalidasi bentuknya. */
type ParsedResult = {
  heatEntryUuid: string;
  position: number;
  completedTimeMs: number | null;
  status: ResultStatus;
};

/**
 * Memeriksa bentuk body Confirm: `results` array tidak kosong; tiap item punya `heat_entry_uuid`
 * (string, tidak dobel), `position` bilangan bulat >= 1, `status` salah satu FINISHED/DNF/DQ/DNS,
 * dan `completed_time_ms` angka >= 0 untuk FINISHED atau null untuk lainnya. Semua kesalahan
 * dikumpulkan sebelum ada yang ditulis. Dipanggil dari `confirmMatchRecord`.
 */
function parseConfirmBody(
  body: Record<string, unknown> | undefined,
): ParsedResult[] {
  const results = body?.results;
  if (!Array.isArray(results) || results.length === 0)
    invalid({ results: ["The results field is required."] });
  const errors: Record<string, string[]> = {};
  const seen = new Set<string>();
  const parsed: ParsedResult[] = [];
  (results as unknown[]).forEach((item, index) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const key = (field: string) => `results.${index}.${field}`;
    const id = row.heat_entry_uuid;
    if (typeof id !== "string" || id === "")
      errors[key("heat_entry_uuid")] = [
        `The results.${index}.heat entry uuid field is required.`,
      ];
    else if (seen.has(id))
      errors[key("heat_entry_uuid")] = [
        `The results.${index}.heat entry uuid field has a duplicate value.`,
      ];
    else seen.add(id);
    const position = toInt(row.position);
    if (position === null || position < 1)
      errors[key("position")] = [
        `The results.${index}.position field must be an integer of at least 1.`,
      ];
    const status = row.status;
    if (
      typeof status !== "string" ||
      !(RESULT_STATUSES as readonly string[]).includes(status)
    )
      errors[key("status")] = [
        `The selected results.${index}.status is invalid.`,
      ];
    const time = row.completed_time_ms;
    const timeInt = time === null || time === undefined ? null : toInt(time);
    if (status === "FINISHED") {
      if (timeInt === null || timeInt < 0)
        errors[key("completed_time_ms")] = [
          `The results.${index}.completed time ms field must be an integer of at least 0 for a finished lane.`,
        ];
    } else if (time !== null && time !== undefined)
      errors[key("completed_time_ms")] = [
        `The results.${index}.completed time ms field must be null unless the lane finished.`,
      ];
    if (
      typeof id === "string" &&
      position !== null &&
      typeof status === "string"
    )
      parsed.push({
        heatEntryUuid: id,
        position,
        completedTimeMs: timeInt,
        status: status as ResultStatus,
      });
  });
  if (Object.keys(errors).length > 0) invalid(errors);
  return parsed;
}

/** Masukan `rankFinishes` dari data tersimpan satu lane. Dipakai Confirm untuk menghitung hasil yang sah. */
function rankInputOf(
  ref: HeatRef,
  session: StoredSession | null,
  entryUuid: string,
): LaneRankInput {
  const finish = activeFinish(session, entryUuid);
  return {
    heatEntryId: heatEntryUuidOf(entryUuid),
    laneNumber: ref.match.entry_uuids.indexOf(entryUuid) + 1,
    callStatus: laneState(entryUuid).call_status,
    finishTimeMs: finish?.captured_time_ms ?? null,
    finishOrder: finish?.finish_order ?? null,
    disqualified: activeDisqualification(entryUuid) !== null,
  };
}

/**
 * `POST /heats/{uuid}/confirm` (BARU, atomik). Urutan cek: 404, 403, 422 (bukan Race, bentuk body),
 * 409 (match sudah DONE; sesi bukan FINISHED/CUTOFF), 422 (daftar hasil tidak mencakup tepat semua
 * lane; hasil tidak sama dengan yang dihitung dari finish, DNS, dan diskualifikasi tersimpan).
 * Semua pemeriksaan selesai SEBELUM menulis, lalu penulisan semua lane dan penutupan heat terjadi
 * bersama (di backend asli: satu transaksi), jadi tidak ada keadaan setengah jadi.
 * Mengembalikan detail match terbaru (DONE).
 */
export function confirmMatchRecord(
  user: MockUser,
  heatUuid: string,
  body: Record<string, unknown> | undefined,
): ApiMatch {
  const ref = heatRef(heatUuid);
  forbidUnless(canRun(user, ref.competition));
  requireRace(ref.competition);
  const parsed = parseConfirmBody(body);
  requireState(
    ref.match.status !== "COMPLETED",
    409,
    "This match is already confirmed.",
  );
  const session = currentSessionOf(heatUuid);
  requireState(
    matchActions(dataContext(ref)).confirm,
    409,
    "Stop the session (finished or cut off) before confirming the result.",
  );
  const laneUuids = ref.match.entry_uuids.map(heatEntryUuidOf);
  requireState(
    parsed.length === laneUuids.length &&
      laneUuids.every((id) => parsed.some((p) => p.heatEntryUuid === id)),
    422,
    "Results must list every lane of the match exactly once.",
  );
  const expected = rankFinishes(
    ref.match.entry_uuids.map((entryUuid) =>
      rankInputOf(ref, session, entryUuid),
    ),
    session?.cutoff_time_ms ?? null,
  );
  const matches = parsed.every((p) => {
    const want = expected.find((e) => e.heatEntryId === p.heatEntryUuid);
    return (
      want !== undefined &&
      want.position === p.position &&
      want.status === p.status &&
      want.completedTimeMs === p.completedTimeMs
    );
  });
  requireState(
    matches,
    422,
    "The submitted results do not match the recorded finishes. Reload the match and try again.",
  );
  // Tulis semuanya (tidak ada lagi yang bisa gagal di sini).
  for (const p of parsed) {
    const entryUuid = entryUuidOfHeatEntry(p.heatEntryUuid) as string;
    matchStore.heatEntries[entryUuid] = {
      call_status: p.status,
      completed_time_ms: p.completedTimeMs,
      position: p.position,
    };
  }
  ref.match.status = "COMPLETED";
  matchStore.heatTimes[heatUuid] = {
    started_at: matchStore.heatTimes[heatUuid]?.started_at ?? null,
    finished_at: iso(new Date()),
  };
  return matchRecord(ref, user);
}

// ---------------------------------------------------------------------------
// Integrasi Results
// ---------------------------------------------------------------------------

/** Satu baris hasil dari match yang sudah dikonfirmasi, untuk mock-results.ts. */
export type ConfirmedRow = {
  entry_uuid: string;
  pet_uuid: string;
  status: ResultStatus;
  finish_time_ms: number | null;
};

/**
 * Baris hasil dari semua match yang sudah DONE di satu kompetisi, urut menurut nomor match lalu
 * posisi. Null bila belum ada match DONE (hasil lama/seed berlaku). Entry tanpa hewan (tim)
 * dilewati. Dipanggil dari mock-results.ts; aturan gabung antar match ada di sana.
 */
export function confirmedRows(competitionUuid: string): ConfirmedRow[] | null {
  const drawing = drawingStore.drawings[competitionUuid];
  const done = (drawing?.matches ?? [])
    .filter((m) => m.status === "COMPLETED")
    .sort((a, b) => a.match_number - b.match_number);
  if (done.length === 0) return null;
  const rows: ConfirmedRow[] = [];
  for (const match of done) {
    const lanes = match.entry_uuids
      .map((entryUuid) => ({ entryUuid, state: laneState(entryUuid) }))
      .sort((a, b) => (a.state.position ?? 0) - (b.state.position ?? 0));
    for (const { entryUuid, state } of lanes) {
      const entry = store.entries.find((e) => e.uuid === entryUuid);
      if (!entry?.pet_uuid) continue;
      const status = (RESULT_STATUSES as readonly string[]).includes(
        state.call_status,
      )
        ? (state.call_status as ResultStatus)
        : "DNS";
      rows.push({
        entry_uuid: entryUuid,
        pet_uuid: entry.pet_uuid,
        status,
        finish_time_ms: state.completed_time_ms,
      });
    }
  }
  return rows;
}
