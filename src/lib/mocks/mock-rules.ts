import type {
  ApiCompetitionActions,
  CompetitionStatus,
  RegistrationClosedReason,
} from "@/domains/competitions/types";
import type { ApiEntryActions, ApiEntrySummary } from "@/domains/entries/types";
import { PERMISSION, type Permission } from "@/lib/auth/permissions";
import type {
  MockCompetition,
  MockEntry,
  MockRegistrationPeriod,
} from "./mock-types";

/**
 * Business rules of the fake backend, one function per backend class
 * (contract 10 §0.2). Screens only read the results (`actions`,
 * `registration_open`, `active_registration_period`, `summary`).
 */

/** Who is calling, worked out once per request (contract 10 §1). */
export type MockCaller = {
  userUuid: string | null;
  permissions: readonly string[];
  /** Org OWNER/ADMIN of the event, an assignment on it, or super admin. */
  managesEvent: boolean;
  /** Any org member or assignment on the event, or super admin (`authorizeEventView`). */
  relatedToEvent: boolean;
};

export const ANONYMOUS: MockCaller = {
  userUuid: null,
  permissions: [],
  managesEvent: false,
  relatedToEvent: false,
};

/** Passes every caller check: tells "the data forbids it" (422) apart from "you may not" (403). */
export const UNRESTRICTED: MockCaller = {
  userUuid: null,
  permissions: Object.values(PERMISSION),
  managesEvent: true,
  relatedToEvent: true,
};

const has = (caller: MockCaller, permission: Permission) =>
  caller.permissions.includes(permission);

const FINISHED: CompetitionStatus[] = ["COMPLETED", "CANCELLED"];

/**
 * Pencarian "entry ini sudah masuk drawing yang terkunci?" (keputusan 0A, Live Mode P5a).
 * Pencarian itu hidup di mock-drawing.ts; modul itu mendaftarkannya lewat
 * `registerDrawnEntryLookup` saat dimuat. Dengan begini mock-rules.ts tidak mengimpor
 * mock-drawing.ts (yang sendiri mengimpor mock-records dan mock-rules), jadi tidak ada impor melingkar.
 */
let drawnEntryLookup: (entryUuid: string) => boolean = () => false;

/** Dipanggil sekali dari mock-drawing.ts saat dimuat. */
export function registerDrawnEntryLookup(
  lookup: (entryUuid: string) => boolean,
) {
  drawnEntryLookup = lookup;
}

/** True bila entry berada di match drawing yang sudah di-lock. Dipanggil dari mock-records dan mock-request. */
export function isEntryDrawn(entryUuid: string): boolean {
  return drawnEntryLookup(entryUuid);
}

/**
 * Backend `EntryActions` (contract 10 §1 table).
 * Keputusan 10 Okt 2026 (kontrak 13 bagian 2): check-in wajib lunas, dan karena belum ada
 * sistem pembayaran, lunas disimulasikan lewat aksi `mark_paid`.
 * Keputusan 0A (11 Okt 2026, Live Mode): entry yang sudah masuk drawing terkunci (`inLockedDrawing`)
 * tidak boleh undo check-in dan tidak boleh mundur. Peserta yang tidak muncul ditandai DNS di
 * match-nya (kontrak 13 bagian 13), bukan dihapus dari drawing.
 */
export function entryActions(
  entry: Pick<
    MockEntry,
    | "owner_uuid"
    | "eligibility_status"
    | "payment_status"
    | "checkin_status"
    | "status"
  >,
  competitionStatus: CompetitionStatus,
  caller: MockCaller,
  inLockedDrawing = false,
): ApiEntryActions {
  const live =
    entry.status === "REGISTERED" && !FINISHED.includes(competitionStatus);
  const approver =
    caller.managesEvent && has(caller, PERMISSION.REGISTRATION_APPROVE);
  const rejecter =
    caller.managesEvent && has(caller, PERMISSION.REGISTRATION_REJECT);
  const pending = entry.eligibility_status === "PENDING";
  const checkedIn = entry.checkin_status === "CHECKED_IN";
  return {
    approve: live && approver && pending,
    reject: live && rejecter && pending,
    mark_paid:
      live &&
      approver &&
      entry.eligibility_status !== "REJECTED" &&
      entry.payment_status === "UNPAID",
    check_in:
      live &&
      approver &&
      entry.eligibility_status === "APPROVED" &&
      entry.payment_status === "PAID" &&
      !checkedIn &&
      (competitionStatus === "SCHEDULED" || competitionStatus === "ONGOING"),
    undo_check_in:
      live &&
      approver &&
      checkedIn &&
      competitionStatus === "SCHEDULED" &&
      !inLockedDrawing,
    withdraw:
      live &&
      caller.userUuid !== null &&
      caller.userUuid === entry.owner_uuid &&
      !checkedIn &&
      !inLockedDrawing,
  };
}

/** Backend `CompetitionActions` (contract 10 §3 table). */
export function competitionActions(
  competition: Pick<MockCompetition, "status" | "registration_closed_at">,
  eventStatus: string,
  caller: MockCaller,
): Required<ApiCompetitionActions> {
  const update =
    caller.managesEvent && has(caller, PERMISSION.COMPETITION_UPDATE);
  const remove =
    caller.managesEvent && has(caller, PERMISSION.COMPETITION_DELETE);
  const { status } = competition;
  return {
    publish:
      update && status === "DRAFT" && eventStatus.toUpperCase() !== "CANCELLED",
    start: update && status === "SCHEDULED",
    complete: update && status === "ONGOING",
    close_registration:
      update &&
      status === "SCHEDULED" &&
      competition.registration_closed_at === null,
    cancel: remove && !FINISHED.includes(status),
    // MOCK ONLY (contract 13 section 9): the backend has no reopen endpoint yet.
    reopen_registration:
      update &&
      status === "SCHEDULED" &&
      competition.registration_closed_at !== null,
  };
}

/** Backend `RegistrationWindow::activePeriod`: the first active period whose window contains `now`. */
export function activePeriod(
  periods: MockRegistrationPeriod[],
  now: Date,
): MockRegistrationPeriod | null {
  const t = now.getTime();
  return (
    periods.find(
      (p) =>
        p.status === "ACTIVE" &&
        new Date(p.registration_start_at).getTime() <= t &&
        t <= new Date(p.registration_end_at).getTime(),
    ) ?? null
  );
}

/**
 * Backend `RegistrationWindow::closedReason`. Order matters: the first
 * failing rule is the reason. `activeEntries` = entries with status REGISTERED.
 */
export function registrationClosedReason(
  competition: Pick<
    MockCompetition,
    "status" | "registration_closed_at" | "capacity"
  >,
  eventStatus: string,
  periods: MockRegistrationPeriod[],
  activeEntries: number,
  now: Date,
): RegistrationClosedReason | null {
  if (eventStatus.toUpperCase() !== "PUBLISHED") return "EVENT_NOT_PUBLISHED";
  if (competition.status !== "SCHEDULED") return "NOT_SCHEDULED";
  if (competition.registration_closed_at !== null) return "CLOSED_BY_ORGANIZER";
  if (periods.length && !activePeriod(periods, now)) return "NO_ACTIVE_PERIOD";
  if (competition.capacity != null && activeEntries >= competition.capacity)
    return "FULL";
  return null;
}

/** Readable 422 messages, same as the backend. */
export const REGISTRATION_CLOSED_MESSAGE: Record<
  RegistrationClosedReason,
  string
> = {
  EVENT_NOT_PUBLISHED: "The event is not published.",
  NOT_SCHEDULED: "This competition is not open for registration.",
  CLOSED_BY_ORGANIZER: "Registration is closed for this competition.",
  NO_ACTIVE_PERIOD: "There is no registration period open right now.",
  FULL: "This competition is full.",
};

/** `summary` of `GET /events/{uuid}/entries`: withdrawn entries never count (contract 10 §2.1). */
export function entrySummary(
  entries: Pick<
    MockEntry,
    "status" | "eligibility_status" | "checkin_status"
  >[],
): ApiEntrySummary {
  const active = entries.filter((e) => e.status !== "WITHDRAWN");
  return {
    total: active.length,
    approved: active.filter((e) => e.eligibility_status === "APPROVED").length,
    checked_in: active.filter((e) => e.checkin_status === "CHECKED_IN").length,
  };
}
