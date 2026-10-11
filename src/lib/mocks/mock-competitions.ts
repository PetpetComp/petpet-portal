import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import type {
  ApiCompetition,
  ApiCompetitionRule,
  ApiRegistrationPeriod,
  ApiScoreCriterion,
} from "@/domains/competitions/types";
import {
  callerFor,
  competitionRecord,
  forbidUnless,
  hasPermission,
} from "./mock-records";
import { nextUuid, store } from "./mock-store";
import type {
  MockCompetition,
  MockCompetitionRule,
  MockRegistrationPeriod,
  MockScoreCriterion,
  MockUser,
} from "./mock-types";

/**
 * Backend palsu untuk workspace kompetisi: detail, PATCH, rule berversi, registration
 * periods, dan score criteria. Bentuk response mengikuti petpet-service (`CompetitionData`,
 * `CompetitionRuleData`, `RegistrationPeriodData`, `ScoreCriterionData`), termasuk harga
 * sebagai string desimal dan daftar sebagai array polos. Dipanggil dari route
 * `/competitions/*` dan `/registration-periods/*` di mock-request.ts.
 * Satu-satunya yang TIDAK ada di backend asli: `reopen-registration` (lihat mock-request.ts).
 */

// ---------------------------------------------------------------------------
// Penyimpanan rule (tabel `competition_rules`)
// ---------------------------------------------------------------------------

/** Satu versi rule dengan nilai bawaan yang sama seperti `CompetitionRuleService::create`. */
function rule(
  competitionUuid: string,
  version: number,
  isActive: boolean,
  over: Partial<MockCompetitionRule>,
): MockCompetitionRule {
  return {
    uuid: `rule-${competitionUuid}-v${version}`,
    competition_uuid: competitionUuid,
    version,
    countdown_enabled: true,
    countdown_seconds: 3,
    concurrent_participant_limit: null,
    time_limit_ms: null,
    attempt_limit: 1,
    checkpoint_total: null,
    lane_total: null,
    qualifier_limit: null,
    best_result_method: null,
    ranking_rule: ["TIME_ASC"],
    tie_break_rule: null,
    timeout_result: null,
    is_active: isActive,
    ...over,
  };
}

/** Data awal: lomba Race selesai (dua versi), checkpoint, dan time trial punya rule. */
function seedRules(): MockCompetitionRule[] {
  return [
    rule("comp-puppy-fun-run", 1, false, {
      lane_total: 4,
      time_limit_ms: 120000,
      ranking_rule: ["POSITION_ASC"],
    }),
    rule("comp-puppy-fun-run", 2, true, {
      lane_total: 5,
      time_limit_ms: 90000,
      ranking_rule: ["POSITION_ASC"],
    }),
    rule("comp-agility-sprint", 1, true, {
      checkpoint_total: 3,
      time_limit_ms: 60000,
      ranking_rule: ["CHECKPOINT_DESC", "TIME_ASC"],
    }),
    rule("comp-glider-mini-agility", 1, true, { time_limit_ms: 90000 }),
    // Race dengan 5 lane untuk demo Drawing (11 peserta -> 4+4+3, 13 peserta -> 5+4+4).
    rule("comp-glider-sprint-heats", 1, true, {
      lane_total: 5,
      time_limit_ms: 90000,
      ranking_rule: ["POSITION_ASC"],
    }),
    rule("comp-glider-derby", 1, true, {
      lane_total: 5,
      time_limit_ms: 90000,
      ranking_rule: ["POSITION_ASC"],
    }),
    // Time trial untuk demo Live Mode: tiga attempt per peserta, cut-off 2 menit, hitung mundur 3 detik.
    rule("comp-glider-time-trial", 1, true, {
      attempt_limit: 3,
      time_limit_ms: 120000,
      countdown_seconds: 3,
      ranking_rule: ["TIME_ASC"],
    }),
    rule("comp-glider-speed-trial", 1, true, {
      attempt_limit: 3,
      time_limit_ms: 120000,
      countdown_seconds: 3,
      ranking_rule: ["TIME_ASC"],
    }),
  ];
}

export const competitionRuleStore = { rules: seedRules() };

/** Mengembalikan rule ke data awal. Dipakai test. */
export function resetCompetitionRuleStore() {
  competitionRuleStore.rules = seedRules();
}

// ---------------------------------------------------------------------------
// Pembantu umum
// ---------------------------------------------------------------------------

const decimal = (amount: number) => amount.toFixed(2);

/** Nama field untuk pesan, seperti Laravel: garis bawah menjadi spasi. */
const labelOf = (field: string) => field.replace(/_/g, " ");

/** Melempar 422 dengan pesan per field, seperti validasi Laravel. */
function invalid(errors: Record<string, string[]>): never {
  throw new ApiError(422, Object.values(errors).flat().join(" "), errors);
}

/** Aturan satu field body, mirip `rules()` FormRequest Laravel. */
type FieldRule = {
  field: string;
  kind: "string" | "int" | "number" | "boolean" | "array" | "date" | "enum";
  required?: boolean;
  /** Boleh tidak dikirim; kalau dikirim harus lolos aturan (`sometimes`). */
  sometimes?: boolean;
  nullable?: boolean;
  min?: number;
  /** Panjang maksimum untuk string. */
  max?: number;
  oneOf?: readonly string[];
};

const KIND_MESSAGE: Record<FieldRule["kind"], string> = {
  string: "must be a string.",
  int: "must be an integer.",
  number: "must be a number.",
  boolean: "field must be true or false.",
  array: "must be an array.",
  date: "must be a valid date.",
  enum: "is invalid.",
};

/** Nilai body cocok dengan jenisnya? Mengembalikan pesan error atau null. */
function problemWith(rule: FieldRule, value: unknown): string | null {
  const label = labelOf(rule.field);
  const typeMessage =
    rule.kind === "enum"
      ? `The selected ${label} is invalid.`
      : rule.kind === "boolean"
        ? `The ${label} ${KIND_MESSAGE.boolean}`
        : `The ${label} field ${KIND_MESSAGE[rule.kind]}`;
  switch (rule.kind) {
    case "string":
      if (typeof value !== "string") return typeMessage;
      if (rule.max !== undefined && value.length > rule.max)
        return `The ${label} field must not be greater than ${rule.max} characters.`;
      return null;
    case "int":
    case "number": {
      const n = typeof value === "string" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isFinite(n)) return typeMessage;
      if (rule.kind === "int" && !Number.isInteger(n)) return typeMessage;
      if (rule.min !== undefined && n < rule.min)
        return `The ${label} field must be at least ${rule.min}.`;
      return null;
    }
    case "boolean":
      return typeof value === "boolean" ||
        [0, 1, "0", "1", "true", "false"].includes(value as never)
        ? null
        : typeMessage;
    case "array":
      return Array.isArray(value) ? null : typeMessage;
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? null
        : typeMessage;
    case "enum":
      return typeof value === "string" && rule.oneOf?.includes(value)
        ? null
        : typeMessage;
  }
}

/**
 * Memeriksa body terhadap `rules`; melempar 422 bila ada yang salah. Seperti Laravel,
 * string kosong dianggap null. Dipanggil lebih dulu dari cek lain (FormRequest jalan sebelum controller).
 */
function validate(
  body: Record<string, unknown> | undefined,
  rules: FieldRule[],
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const r of rules) {
    const raw = body?.[r.field];
    const value = raw === "" ? null : raw;
    if (value === undefined) {
      if (r.required)
        errors[r.field] = [`The ${labelOf(r.field)} field is required.`];
      continue;
    }
    if (value === null) {
      if (r.required)
        errors[r.field] = [`The ${labelOf(r.field)} field is required.`];
      else if (!r.nullable && r.sometimes)
        errors[r.field] = [`The ${labelOf(r.field)} field is invalid.`];
      continue;
    }
    const message = problemWith(r, value);
    if (message) errors[r.field] = [message];
  }
  return errors;
}

/** Gabungan `validate` + aturan "after" antar tanggal, lalu melempar bila ada error. */
function validateOrFail(
  body: Record<string, unknown> | undefined,
  rules: FieldRule[],
  after?: { field: string; than: string; thanValue: unknown },
) {
  const errors = validate(body, rules);
  const end = body?.[after?.field ?? ""];
  if (after && end != null && end !== "" && !errors[after.field]) {
    const startMs = Date.parse(String(after.thanValue));
    if (Number.isNaN(startMs) || Date.parse(String(end)) <= startMs)
      errors[after.field] = [
        `The ${labelOf(after.field)} field must be a date after ${labelOf(after.than)}.`,
      ];
  }
  if (Object.keys(errors).length > 0) invalid(errors);
}

const numberOrNull = (value: unknown): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

function findCompetition(uuid: string): MockCompetition {
  const competition = store.competitions.find((c) => c.uuid === uuid);
  if (!competition) throw new ApiError(404, "Competition not found.");
  return competition;
}

/**
 * Seperti `authorizeEventAction(event, COMPETITION_UPDATE)`: harus mengelola event
 * dan punya izin `competition.update`, kalau tidak 403.
 */
function requireUpdate(user: MockUser, competition: MockCompetition) {
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(
    caller.managesEvent && hasPermission(caller, PERMISSION.COMPETITION_UPDATE),
  );
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/** `CompetitionRuleData::toArray`. */
export function ruleRecord(r: MockCompetitionRule): ApiCompetitionRule {
  return {
    uuid: r.uuid,
    version: r.version,
    countdown_enabled: r.countdown_enabled,
    countdown_seconds: r.countdown_seconds,
    concurrent_participant_limit: r.concurrent_participant_limit,
    time_limit_ms: r.time_limit_ms,
    attempt_limit: r.attempt_limit,
    checkpoint_total: r.checkpoint_total,
    lane_total: r.lane_total,
    qualifier_limit: r.qualifier_limit,
    best_result_method: r.best_result_method,
    ranking_rule: r.ranking_rule,
    tie_break_rule: r.tie_break_rule,
    timeout_result: r.timeout_result,
    is_active: r.is_active,
  };
}

/** `RegistrationPeriodData::toArray`: harga string desimal "70000.00". */
export function periodRecord(p: MockRegistrationPeriod): ApiRegistrationPeriod {
  return {
    uuid: p.uuid,
    competition_uuid: p.competition_uuid,
    period_type: p.period_type,
    price: decimal(p.price),
    quota: p.quota,
    registration_start_at: p.registration_start_at,
    registration_end_at: p.registration_end_at,
    status: p.status,
  };
}

/** `ScoreCriterionData::toArray`: bobot dan skor string desimal. */
export function criterionRecord(c: MockScoreCriterion): ApiScoreCriterion {
  return {
    uuid: c.uuid,
    competition_uuid: c.competition_uuid,
    code: c.code,
    name: c.name,
    description: c.description,
    weight: decimal(c.weight),
    min_score: decimal(c.min_score),
    max_score: decimal(c.max_score),
    note_required: c.note_required,
    display_order: c.display_order,
    status: c.status,
  };
}

// ---------------------------------------------------------------------------
// Kompetisi
// ---------------------------------------------------------------------------

/** `GET /competitions/{uuid}`: tanpa login pun boleh, `actions` semuanya false. */
export function getCompetitionRecord(
  user: MockUser | null,
  uuid: string,
): ApiCompetition {
  const competition = findCompetition(uuid);
  return competitionRecord(
    competition,
    callerFor(user, competition.event_uuid),
  );
}

const UPDATE_COMPETITION_RULES: FieldRule[] = [
  { field: "name", kind: "string", sometimes: true, max: 200 },
  { field: "description", kind: "string", nullable: true },
  { field: "arena_name", kind: "string", nullable: true, max: 200 },
  { field: "capacity", kind: "int", nullable: true, min: 1 },
  { field: "scheduled_start_at", kind: "date", sometimes: true },
  { field: "scheduled_end_at", kind: "date", sometimes: true },
  { field: "minimum_judges", kind: "int", nullable: true, min: 1 },
];

/**
 * `PATCH /competitions/{uuid}` (backend `UpdateRequest`): hanya field yang dikirim yang berubah,
 * `null` mengosongkan. Seperti Laravel, `scheduled_end_at` dibandingkan dengan
 * `scheduled_start_at` yang IKUT dikirim, jadi tanggal harus dikirim berpasangan.
 */
export function updateCompetitionRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiCompetition {
  validateOrFail(body, UPDATE_COMPETITION_RULES, {
    field: "scheduled_end_at",
    than: "scheduled_start_at",
    thanValue: body?.scheduled_start_at,
  });
  const competition = findCompetition(uuid);
  requireUpdate(user, competition);

  const has = (key: string) => body !== undefined && key in body;
  if (has("name")) competition.name = String(body?.name);
  if (has("description"))
    competition.description = body?.description
      ? String(body.description)
      : undefined;
  if (has("arena_name"))
    competition.arena_name = body?.arena_name
      ? String(body.arena_name)
      : undefined;
  if (has("capacity"))
    competition.capacity = numberOrNull(body?.capacity) ?? undefined;
  if (has("minimum_judges"))
    competition.minimum_judges =
      numberOrNull(body?.minimum_judges) ?? undefined;
  if (has("scheduled_start_at"))
    competition.scheduled_start_at = String(body?.scheduled_start_at);
  if (has("scheduled_end_at"))
    competition.scheduled_end_at = String(body?.scheduled_end_at);
  return competitionRecord(
    competition,
    callerFor(user, competition.event_uuid),
  );
}

// ---------------------------------------------------------------------------
// Rule berversi
// ---------------------------------------------------------------------------

/** `GET /competitions/{uuid}/rules`: semua versi, terlama dulu. Wajib login dan terkait event. */
export function listRuleRecords(
  user: MockUser,
  uuid: string,
): ApiCompetitionRule[] {
  const competition = findCompetition(uuid);
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(
    caller.relatedToEvent && hasPermission(caller, PERMISSION.COMPETITION_VIEW),
  );
  return competitionRuleStore.rules
    .filter((r) => r.competition_uuid === uuid)
    .sort((a, b) => a.version - b.version)
    .map(ruleRecord);
}

const CREATE_RULE_RULES: FieldRule[] = [
  { field: "countdown_enabled", kind: "boolean", sometimes: true },
  { field: "countdown_seconds", kind: "int", sometimes: true, min: 0 },
  {
    field: "concurrent_participant_limit",
    kind: "int",
    nullable: true,
    min: 1,
  },
  { field: "time_limit_ms", kind: "int", nullable: true, min: 1 },
  { field: "attempt_limit", kind: "int", sometimes: true, min: 1 },
  { field: "checkpoint_total", kind: "int", nullable: true, min: 0 },
  { field: "lane_total", kind: "int", nullable: true, min: 1 },
  { field: "qualifier_limit", kind: "int", nullable: true, min: 1 },
  { field: "best_result_method", kind: "string", nullable: true, max: 50 },
  { field: "ranking_rule", kind: "array", required: true },
  { field: "tie_break_rule", kind: "array", nullable: true },
  { field: "timeout_result", kind: "string", nullable: true, max: 30 },
];

/**
 * `POST /competitions/{uuid}/rules` (`CompetitionRuleService::create`): selalu versi BARU,
 * versi lama dinonaktifkan. Field yang tidak dikirim memakai nilai bawaan, BUKAN nilai
 * versi lama, jadi pemanggil harus membawa nilai lama bila ingin mempertahankannya.
 */
export function createRuleRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiCompetitionRule {
  validateOrFail(body, CREATE_RULE_RULES);
  const competition = findCompetition(uuid);
  requireUpdate(user, competition);

  const existing = competitionRuleStore.rules.filter(
    (r) => r.competition_uuid === uuid,
  );
  for (const r of existing) r.is_active = false;
  const version = Math.max(0, ...existing.map((r) => r.version)) + 1;
  const created: MockCompetitionRule = {
    uuid: nextUuid(),
    competition_uuid: uuid,
    version,
    countdown_enabled:
      body?.countdown_enabled === undefined
        ? true
        : [true, 1, "1", "true"].includes(body.countdown_enabled as never),
    countdown_seconds: numberOrNull(body?.countdown_seconds) ?? 3,
    concurrent_participant_limit: numberOrNull(
      body?.concurrent_participant_limit,
    ),
    time_limit_ms: numberOrNull(body?.time_limit_ms),
    attempt_limit: numberOrNull(body?.attempt_limit) ?? 1,
    checkpoint_total: numberOrNull(body?.checkpoint_total),
    lane_total: numberOrNull(body?.lane_total),
    qualifier_limit: numberOrNull(body?.qualifier_limit),
    best_result_method: body?.best_result_method
      ? String(body.best_result_method)
      : null,
    ranking_rule: body?.ranking_rule as string[],
    tie_break_rule:
      (body?.tie_break_rule as string[] | null | undefined) ?? null,
    timeout_result: body?.timeout_result ? String(body.timeout_result) : null,
    is_active: true,
  };
  competitionRuleStore.rules.push(created);
  return ruleRecord(created);
}

// ---------------------------------------------------------------------------
// Registration periods
// ---------------------------------------------------------------------------

const PERIOD_TYPES = ["EARLY_BIRD", "ONLINE", "ON_SITE"] as const;

const CREATE_PERIOD_RULES: FieldRule[] = [
  { field: "period_type", kind: "enum", required: true, oneOf: PERIOD_TYPES },
  { field: "price", kind: "number", required: true, min: 0 },
  { field: "quota", kind: "int", nullable: true, min: 1 },
  { field: "registration_start_at", kind: "date", required: true },
  { field: "registration_end_at", kind: "date", required: true },
];

const UPDATE_PERIOD_RULES: FieldRule[] = [
  { field: "price", kind: "number", sometimes: true, min: 0 },
  { field: "quota", kind: "int", nullable: true, min: 1 },
  { field: "registration_start_at", kind: "date", sometimes: true },
  { field: "registration_end_at", kind: "date", sometimes: true },
];

function findPeriod(uuid: string): MockRegistrationPeriod {
  const period = store.registrationPeriods.find((p) => p.uuid === uuid);
  if (!period) throw new ApiError(404, "Registration period not found.");
  return period;
}

/** `GET /competitions/{uuid}/registration-periods`: array polos, channel yang ditutup ikut. */
export function listPeriodRecords(uuid: string): ApiRegistrationPeriod[] {
  findCompetition(uuid);
  return store.registrationPeriods
    .filter((p) => p.competition_uuid === uuid)
    .map(periodRecord);
}

/**
 * `POST /competitions/{uuid}/registration-periods`: satu channel per tipe per kompetisi
 * (422 bila sudah ada, termasuk yang CLOSED).
 */
export function createPeriodRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiRegistrationPeriod {
  validateOrFail(body, CREATE_PERIOD_RULES, {
    field: "registration_end_at",
    than: "registration_start_at",
    thanValue: body?.registration_start_at,
  });
  const competition = findCompetition(uuid);
  requireUpdate(user, competition);
  if (
    store.registrationPeriods.some(
      (p) => p.competition_uuid === uuid && p.period_type === body?.period_type,
    )
  )
    throw new ApiError(
      422,
      "A registration period of this type already exists for this competition.",
    );
  const period: MockRegistrationPeriod = {
    uuid: nextUuid(),
    competition_uuid: uuid,
    period_type: body?.period_type as MockRegistrationPeriod["period_type"],
    price: Number(body?.price),
    quota: numberOrNull(body?.quota),
    registration_start_at: String(body?.registration_start_at),
    registration_end_at: String(body?.registration_end_at),
    status: "ACTIVE",
  };
  store.registrationPeriods.push(period);
  return periodRecord(period);
}

/**
 * `PATCH /registration-periods/{uuid}`: `period_type` dan status tidak bisa diubah di sini.
 * Seperti Laravel, tanggal selesai dibandingkan dengan tanggal mulai yang ikut dikirim.
 */
export function updatePeriodRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiRegistrationPeriod {
  validateOrFail(body, UPDATE_PERIOD_RULES, {
    field: "registration_end_at",
    than: "registration_start_at",
    thanValue: body?.registration_start_at,
  });
  const period = findPeriod(uuid);
  requireUpdate(user, findCompetition(period.competition_uuid));
  const has = (key: string) => body !== undefined && key in body;
  if (has("price")) period.price = Number(body?.price);
  if (has("quota")) period.quota = numberOrNull(body?.quota);
  if (has("registration_start_at"))
    period.registration_start_at = String(body?.registration_start_at);
  if (has("registration_end_at"))
    period.registration_end_at = String(body?.registration_end_at);
  return periodRecord(period);
}

/** `DELETE /registration-periods/{uuid}`: baris tidak dihapus, statusnya menjadi CLOSED. */
export function closePeriodRecord(
  user: MockUser,
  uuid: string,
): ApiRegistrationPeriod {
  const period = findPeriod(uuid);
  requireUpdate(user, findCompetition(period.competition_uuid));
  period.status = "CLOSED";
  return periodRecord(period);
}

// ---------------------------------------------------------------------------
// Score criteria
// ---------------------------------------------------------------------------

const CREATE_CRITERION_RULES: FieldRule[] = [
  { field: "code", kind: "string", required: true, max: 50 },
  { field: "name", kind: "string", required: true, max: 200 },
  { field: "description", kind: "string", nullable: true },
  { field: "weight", kind: "number", required: true, min: 0 },
  { field: "min_score", kind: "number", required: true },
  { field: "max_score", kind: "number", required: true },
  { field: "note_required", kind: "boolean", sometimes: true },
  { field: "display_order", kind: "int", sometimes: true, min: 0 },
];

/** `GET /competitions/{uuid}/score-criteria`: urut `display_order`, array polos. */
export function listCriterionRecords(uuid: string): ApiScoreCriterion[] {
  findCompetition(uuid);
  return store.scoreCriteria
    .filter((c) => c.competition_uuid === uuid)
    .sort((a, b) => a.display_order - b.display_order)
    .map(criterionRecord);
}

/** `POST /competitions/{uuid}/score-criteria`: kode dan urutan harus unik per kompetisi (422). */
export function createCriterionRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiScoreCriterion {
  validateOrFail(body, CREATE_CRITERION_RULES);
  if (Number(body?.max_score) <= Number(body?.min_score))
    invalid({
      max_score: ["The max score field must be greater than min score."],
    });
  const competition = findCompetition(uuid);
  requireUpdate(user, competition);

  const siblings = store.scoreCriteria.filter(
    (c) => c.competition_uuid === uuid,
  );
  if (siblings.some((c) => c.code === body?.code))
    throw new ApiError(
      422,
      "A score criterion with this code already exists for this competition.",
    );
  const order = numberOrNull(body?.display_order);
  if (order !== null && siblings.some((c) => c.display_order === order))
    throw new ApiError(
      422,
      "A score criterion with this display order already exists for this competition.",
    );
  const criterion: MockScoreCriterion = {
    uuid: nextUuid(),
    competition_uuid: uuid,
    code: String(body?.code),
    name: String(body?.name),
    description: body?.description ? String(body.description) : null,
    weight: Number(body?.weight),
    min_score: Number(body?.min_score),
    max_score: Number(body?.max_score),
    note_required: body?.note_required === true,
    display_order:
      order ?? Math.max(0, ...siblings.map((c) => c.display_order)) + 1,
    status: "ACTIVE",
  };
  store.scoreCriteria.push(criterion);
  return criterionRecord(criterion);
}
