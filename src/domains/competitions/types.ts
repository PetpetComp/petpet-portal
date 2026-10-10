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
  "cancel",
] as const;
export type CompetitionAction = (typeof COMPETITION_ACTIONS)[number];

export const COMPETITION_ACTION_LABEL: Record<CompetitionAction, string> = {
  publish: "Publish",
  start: "Start",
  complete: "Complete",
  closeRegistration: "Close registration",
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
  name: string;
  arenaName: string;
  capacity: number | null;
  startAt: string;
  endAt: string;
  registrationClosed: boolean;
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
    name: row.name,
    arenaName: row.arena_name ?? "",
    capacity: row.capacity,
    startAt: row.scheduled_start_at ?? "",
    endAt: row.scheduled_end_at ?? "",
    registrationClosed: row.registration_closed_at !== null,
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
