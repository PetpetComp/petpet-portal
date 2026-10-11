/** How a competition type produces results (backend `competition_types.result_mode`). */
export type ResultMode =
  "TIME" | "POSITION" | "CHECKPOINT" | "JUDGED_SCORE" | "COMBINED";

/**
 * Lifecycle (backend `Competition::STATUS_*`). Registration open/closed is separate:
 * `registration_closed_at` plus the registration periods.
 */
export const COMPETITION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const COMPETITION_STATUS_LABEL: Record<CompetitionStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Upcoming",
  ONGOING: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Why the API says registration is closed (backend `RegistrationWindow`). */
export type RegistrationClosedReason =
  | "EVENT_NOT_PUBLISHED"
  | "NOT_SCHEDULED"
  | "CLOSED_BY_ORGANIZER"
  | "NO_ACTIVE_PERIOD"
  | "FULL";

export const REGISTRATION_CLOSED_REASON_LABEL: Record<
  RegistrationClosedReason,
  string
> = {
  EVENT_NOT_PUBLISHED: "Event unpublished",
  NOT_SCHEDULED: "Closed",
  CLOSED_BY_ORGANIZER: "Closed by organizer",
  NO_ACTIVE_PERIOD: "No open period",
  FULL: "Full",
};

/** Channel a registration is charged under (backend `RegistrationPeriodConstant::TYPES`). */
export const REGISTRATION_PERIOD_TYPES = [
  "EARLY_BIRD",
  "ONLINE",
  "ON_SITE",
] as const;
export type RegistrationPeriodType = (typeof REGISTRATION_PERIOD_TYPES)[number];

/** The period new entries are charged under right now (backend `RegistrationWindow::activePeriod`). */
export type ApiActiveRegistrationPeriod = {
  uuid: string;
  period_type: RegistrationPeriodType;
  price: string;
  registration_end_at: string;
};

/** What the caller may do with this competition (backend `CompetitionActions`). */
export type ApiCompetitionActions = {
  publish: boolean;
  start: boolean;
  complete: boolean;
  cancel: boolean;
  close_registration: boolean;
  /**
   * MOCK ONLY: the real backend has no reopen endpoint yet, so the key is absent there and
   * reads as false (draft contract, `POST /competitions/{uuid}/reopen-registration`).
   */
  reopen_registration?: boolean;
};

/** One competition exactly as the API sends it (petpet-service `CompetitionData::toArray`). */
export type ApiCompetition = {
  uuid: string;
  event_uuid: string;
  competition_type_uuid: string;
  species_uuid: string | null;
  name: string;
  slug: string;
  description: string | null;
  arena_name: string | null;
  capacity: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  minimum_judges: number;
  registration_closed_at: string | null;
  status: CompetitionStatus;
  /** Decided by the backend; never re-derive it here. */
  registration_open: boolean;
  registration_closed_reason: RegistrationClosedReason | null;
  /** Null when no period is active. Decided by the backend. */
  active_registration_period: ApiActiveRegistrationPeriod | null;
  actions: ApiCompetitionActions;
};

/** `GET /master/competition-types` item. */
export type ApiCompetitionType = {
  uuid: string;
  code: string;
  name: string;
  result_mode: ResultMode;
  description: string | null;
};

/** `GET /master/species` item. */
export type ApiSpecies = {
  uuid: string;
  code: string;
  name: string;
};

/** Row actions on the competitions tab; each maps to one endpoint. */
export const COMPETITION_ACTIONS = [
  "publish",
  "start",
  "complete",
  "closeRegistration",
  "reopenRegistration",
  "cancel",
] as const;
export type CompetitionAction = (typeof COMPETITION_ACTIONS)[number];

export const COMPETITION_ACTION_LABEL: Record<CompetitionAction, string> = {
  publish: "Publish",
  start: "Start",
  complete: "Complete",
  closeRegistration: "Close registration",
  reopenRegistration: "Reopen registration",
  cancel: "Cancel",
};

export type ActiveRegistrationPeriod = {
  id: string;
  type: RegistrationPeriodType;
  price: number;
  endsAt: string;
};

/** Screen shapes, built only by the mappers below. */
export type Competition = {
  id: string;
  eventId: string;
  typeId: string;
  /** Null = every animal is allowed. */
  speciesId: string | null;
  name: string;
  description: string;
  arenaName: string;
  capacity: number | null;
  minimumJudges: number;
  startAt: string;
  endAt: string;
  registrationClosed: boolean;
  /** When the organizer closed registration (ISO); null while it was never closed. */
  registrationClosedAt: string | null;
  /** From the API (`registration_open`); the backend owns the rule. */
  registrationOpen: boolean;
  registrationClosedReason: RegistrationClosedReason | null;
  /** From the API; never pick a period on the client. */
  activeRegistrationPeriod: ActiveRegistrationPeriod | null;
  status: CompetitionStatus;
  actions: Record<CompetitionAction, boolean>;
};

export type CompetitionType = {
  id: string;
  code: string;
  name: string;
  resultMode: ResultMode;
};

export type Species = { id: string; name: string };

export function fromApi(row: ApiCompetition): Competition {
  return {
    id: row.uuid,
    eventId: row.event_uuid,
    typeId: row.competition_type_uuid,
    speciesId: row.species_uuid,
    name: row.name,
    description: row.description ?? "",
    arenaName: row.arena_name ?? "",
    capacity: row.capacity,
    minimumJudges: row.minimum_judges ?? 1,
    startAt: row.scheduled_start_at ?? "",
    endAt: row.scheduled_end_at ?? "",
    registrationClosed: row.registration_closed_at !== null,
    registrationClosedAt: row.registration_closed_at,
    registrationOpen: row.registration_open,
    registrationClosedReason: row.registration_closed_reason,
    activeRegistrationPeriod: row.active_registration_period && {
      id: row.active_registration_period.uuid,
      type: row.active_registration_period.period_type,
      price: Number(row.active_registration_period.price),
      endsAt: row.active_registration_period.registration_end_at,
    },
    status: row.status,
    actions: {
      publish: row.actions.publish,
      start: row.actions.start,
      complete: row.actions.complete,
      closeRegistration: row.actions.close_registration,
      reopenRegistration: row.actions.reopen_registration === true,
      cancel: row.actions.cancel,
    },
  };
}

export const typeFromApi = (row: ApiCompetitionType): CompetitionType => ({
  id: row.uuid,
  code: row.code,
  name: row.name,
  resultMode: row.result_mode,
});

export const speciesFromApi = (row: ApiSpecies): Species => ({
  id: row.uuid,
  name: row.name,
});

/** Status of one registration period (backend `RegistrationPeriodConstant::STATUSES`). */
export type PeriodStatus = "ACTIVE" | "CLOSED";

/** `GET /competitions/{uuid}/registration-periods` item (petpet-service `RegistrationPeriodData`). */
export type ApiRegistrationPeriod = {
  uuid: string;
  competition_uuid: string;
  period_type: RegistrationPeriodType;
  /** Decimal string, e.g. "70000.00". */
  price: string;
  quota: number | null;
  registration_start_at: string;
  registration_end_at: string;
  status: PeriodStatus;
};

export type RegistrationPeriod = {
  id: string;
  competitionId: string;
  type: RegistrationPeriodType;
  price: number;
  quota: number | null;
  startAt: string;
  endAt: string;
  status: PeriodStatus;
};

/** Body of `PATCH /registration-periods/{uuid}` (backend `UpdateRegistrationPeriodRequest`). */
export type ApiPeriodUpdate = {
  price?: number;
  quota?: number | null;
  registration_start_at?: string;
  registration_end_at?: string;
};

/** `GET /competitions/{uuid}/rules` item (petpet-service `CompetitionRuleData`). One row per version. */
export type ApiCompetitionRule = {
  uuid: string;
  version: number;
  countdown_enabled: boolean;
  countdown_seconds: number;
  concurrent_participant_limit: number | null;
  time_limit_ms: number | null;
  attempt_limit: number;
  checkpoint_total: number | null;
  lane_total: number | null;
  qualifier_limit: number | null;
  best_result_method: string | null;
  ranking_rule: string[];
  tie_break_rule: string[] | null;
  timeout_result: string | null;
  /** Only the latest version is active. */
  is_active: boolean;
};

/** Body of `POST /competitions/{uuid}/rules` (backend `CreateRuleRequest`); only `ranking_rule` is required. */
export type ApiRuleBody = Partial<
  Omit<ApiCompetitionRule, "uuid" | "version" | "is_active">
> & { ranking_rule: string[] };

export type CompetitionRule = {
  id: string;
  version: number;
  countdownEnabled: boolean;
  countdownSeconds: number;
  concurrentParticipantLimit: number | null;
  /** Cut-off time in milliseconds; null = no cut-off. */
  timeLimitMs: number | null;
  attemptLimit: number;
  checkpointTotal: number | null;
  laneTotal: number | null;
  qualifierLimit: number | null;
  bestResultMethod: string | null;
  rankingRule: string[];
  tieBreakRule: string[] | null;
  timeoutResult: string | null;
  isActive: boolean;
};

/** `GET /competitions/{uuid}/score-criteria` item (petpet-service `ScoreCriterionData`). */
export type ApiScoreCriterion = {
  uuid: string;
  competition_uuid: string;
  code: string;
  name: string;
  description: string | null;
  /** Decimal strings, e.g. "40.00". */
  weight: string;
  min_score: string;
  max_score: string;
  note_required: boolean;
  display_order: number;
  status: "ACTIVE" | "INACTIVE";
};

export type ScoreCriterion = {
  id: string;
  code: string;
  name: string;
  description: string;
  weight: number;
  min: number;
  max: number;
  noteRequired: boolean;
  displayOrder: number;
  active: boolean;
};

/** Period API -> screen. `price` arrives as a decimal string. */
export const periodFromApi = (
  row: ApiRegistrationPeriod,
): RegistrationPeriod => ({
  id: row.uuid,
  competitionId: row.competition_uuid,
  type: row.period_type,
  price: Number(row.price),
  quota: row.quota,
  startAt: row.registration_start_at,
  endAt: row.registration_end_at,
  status: row.status,
});

export const ruleFromApi = (row: ApiCompetitionRule): CompetitionRule => ({
  id: row.uuid,
  version: row.version,
  countdownEnabled: row.countdown_enabled,
  countdownSeconds: row.countdown_seconds,
  concurrentParticipantLimit: row.concurrent_participant_limit,
  timeLimitMs: row.time_limit_ms,
  attemptLimit: row.attempt_limit,
  checkpointTotal: row.checkpoint_total,
  laneTotal: row.lane_total,
  qualifierLimit: row.qualifier_limit,
  bestResultMethod: row.best_result_method,
  rankingRule: row.ranking_rule,
  tieBreakRule: row.tie_break_rule,
  timeoutResult: row.timeout_result,
  isActive: row.is_active,
});

export const criterionFromApi = (row: ApiScoreCriterion): ScoreCriterion => ({
  id: row.uuid,
  code: row.code,
  name: row.name,
  description: row.description ?? "",
  weight: Number(row.weight),
  min: Number(row.min_score),
  max: Number(row.max_score),
  noteRequired: row.note_required,
  displayOrder: row.display_order,
  active: row.status === "ACTIVE",
});

/**
 * Rule in force: the one the API marks active, else the highest version.
 * Called from the shell (lanes, cut-off), Overview and Settings. Null when no rule exists yet.
 */
export function currentRule(rules: CompetitionRule[]): CompetitionRule | null {
  if (rules.length === 0) return null;
  const active = rules.find((r) => r.isActive);
  if (active) return active;
  return rules.reduce((best, r) => (r.version > best.version ? r : best));
}
