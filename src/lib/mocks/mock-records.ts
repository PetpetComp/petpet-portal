import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import type { ApiCompetition } from "@/domains/competitions/types";
import {
  CHECKIN_STATUSES,
  ELIGIBILITY_STATUSES,
  ENTRY_SORTS,
  ENTRY_STATUSES,
  PAYMENT_STATUSES,
  type ApiEntry,
  type ApiEventEntries,
  type ApiOwnerSearchResult,
} from "@/domains/entries/types";
import { mockAccess } from "./mock-access";
import {
  ANONYMOUS,
  activePeriod,
  competitionActions,
  entryActions,
  entrySummary,
  REGISTRATION_CLOSED_MESSAGE,
  registrationClosedReason,
  type MockCaller,
} from "./mock-rules";
import { findOrThrow, store } from "./mock-store";
import type { MockCompetition, MockEntry, MockUser } from "./mock-types";

/** Serializers and queries of the fake backend: same shapes as contract 10. */

/** Caller rights on one event, worked out once per request. */
export function callerFor(
  user: MockUser | null,
  eventUuid: string,
): MockCaller {
  if (!user) return ANONYMOUS;
  const access = mockAccess(user);
  const superAdmin = access.roles.some((r) => r.code === "SUPER_ADMIN");
  const event = store.events.find((e) => e.uuid === eventUuid);
  const membership = access.organizations.find(
    (o) => o.uuid === event?.organization_uuid,
  );
  const assigned = access.staff_assignments.some(
    (a) => a.event_uuid === eventUuid,
  );
  return {
    userUuid: user.uuid,
    permissions: access.permissions,
    managesEvent:
      superAdmin ||
      assigned ||
      ["OWNER", "ADMIN"].includes(membership?.member_role ?? ""),
    relatedToEvent: superAdmin || assigned || !!membership,
  };
}

export const hasPermission = (caller: MockCaller, permission: string) =>
  caller.permissions.includes(permission);

export function forbidUnless(allowed: boolean) {
  if (!allowed)
    throw new ApiError(
      403,
      "You don't have permission to perform this action.",
    );
}

/** Like Carbon `toIso8601String()`: "2026-10-10T08:12:00+00:00". */
export const iso = (date: Date) =>
  date.toISOString().replace(/\.\d{3}Z$/, "+00:00");

/** 422 when the data forbids it, 403 when only the caller is the problem. */
export function guard(
  allowedForCaller: boolean,
  allowedByData: boolean,
  message: string,
) {
  if (!allowedByData) throw new ApiError(422, message);
  forbidUnless(allowedForCaller);
}

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

const decimal = (amount: number) => amount.toFixed(2);

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const eventOf = (competition: MockCompetition) =>
  findOrThrow(store.events, competition.event_uuid, "Event");

const periodsOf = (competitionUuid: string) =>
  store.registrationPeriods.filter(
    (p) => p.competition_uuid === competitionUuid,
  );

const activeEntryCount = (competitionUuid: string) =>
  store.entries.filter(
    (e) => e.competition_uuid === competitionUuid && e.status === "REGISTERED",
  ).length;

/** `RegistrationWindow` for one stored competition. */
export function registrationWindowOf(
  competition: MockCompetition,
  now = new Date(),
) {
  const periods = periodsOf(competition.uuid);
  return {
    closedReason: registrationClosedReason(
      competition,
      eventOf(competition).status,
      periods,
      activeEntryCount(competition.uuid),
      now,
    ),
    activePeriod: activePeriod(periods, now),
  };
}

/** `CompetitionData::toArray` (contract 10 §3). */
export function competitionRecord(
  competition: MockCompetition,
  caller: MockCaller,
  now = new Date(),
): ApiCompetition {
  const window = registrationWindowOf(competition, now);
  const period = window.activePeriod;
  return {
    uuid: competition.uuid,
    event_uuid: competition.event_uuid,
    competition_type_uuid: competition.competition_type_uuid,
    species_uuid: competition.species_uuid ?? null,
    name: competition.name,
    slug: slugify(competition.name),
    description: competition.description ?? null,
    arena_name: competition.arena_name ?? null,
    capacity: competition.capacity ?? null,
    scheduled_start_at: competition.scheduled_start_at ?? null,
    scheduled_end_at: competition.scheduled_end_at ?? null,
    minimum_judges: competition.minimum_judges ?? 1,
    registration_closed_at: competition.registration_closed_at,
    status: competition.status,
    registration_open: window.closedReason === null,
    registration_closed_reason: window.closedReason,
    active_registration_period: period && {
      uuid: period.uuid,
      period_type: period.period_type,
      price: decimal(period.price),
      registration_end_at: period.registration_end_at,
    },
    actions: competitionActions(
      competition,
      eventOf(competition).status,
      caller,
    ),
  };
}

/** `EntryData::toArray` (contract 10 §1). */
export function entryRecord(entry: MockEntry, caller: MockCaller): ApiEntry {
  const competition = findOrThrow(
    store.competitions,
    entry.competition_uuid,
    "Competition",
  );
  const owner = findOrThrow(store.users, entry.owner_uuid, "User");
  const pet = store.pets.find((p) => p.uuid === entry.pet_uuid) ?? null;
  const morph = store.petMorphs.find((m) => m.uuid === pet?.morph_uuid);
  return {
    uuid: entry.uuid,
    participant_code: entry.participant_code,
    competition_uuid: competition.uuid,
    competition_name: competition.name,
    registration_period_uuid: entry.registration_period_uuid,
    owner_uuid: owner.uuid,
    owner_name: fullName(owner),
    owner_phone: owner.phone ?? null,
    pet_uuid: pet?.uuid ?? null,
    pet_name: pet?.name ?? null,
    pet_morph_name: morph?.name ?? null,
    team_uuid: entry.team_uuid,
    bib_number: entry.bib_number,
    registration_fee: decimal(entry.registration_fee),
    eligibility_status: entry.eligibility_status,
    payment_status: entry.payment_status,
    checkin_status: entry.checkin_status,
    status: entry.status,
    registered_at: entry.registered_at,
    checked_in_at: entry.checked_in_at,
    actions: entryActions(entry, competition.status, caller),
  };
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === null || value === "") return undefined;
  if (!(allowed as readonly string[]).includes(value))
    throw new ApiError(422, `The selected ${field} is invalid.`);
  return value as T;
}

const compareNullable = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b);

/** `GET /events/{uuid}/entries` (contract 10 §2.1). */
export function listEventEntries(
  eventUuid: string,
  query: URLSearchParams,
  caller: MockCaller,
): ApiEventEntries {
  findOrThrow(store.events, eventUuid, "Event");
  forbidUnless(
    caller.relatedToEvent &&
      hasPermission(caller, PERMISSION.REGISTRATION_VIEW),
  );
  const competitionIds = store.competitions
    .filter((c) => c.event_uuid === eventUuid)
    .map((c) => c.uuid);
  const competitionId = query.get("competition_id") || null;
  if (competitionId && !competitionIds.includes(competitionId))
    throw new ApiError(422, "The competition does not belong to this event.");

  const eligibility = oneOf(
    query.get("eligibility_status"),
    ELIGIBILITY_STATUSES,
    "eligibility status",
  );
  const payment = oneOf(
    query.get("payment_status"),
    PAYMENT_STATUSES,
    "payment status",
  );
  const checkin = oneOf(
    query.get("checkin_status"),
    CHECKIN_STATUSES,
    "check-in status",
  );
  const status = oneOf(query.get("status"), ENTRY_STATUSES, "status");
  const sort = oneOf(query.get("sort"), ENTRY_SORTS, "sort") ?? "registered_at";
  const direction =
    oneOf(query.get("direction"), ["asc", "desc"] as const, "direction") ??
    (sort === "registered_at" ? "desc" : "asc");
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const perPage = Number(query.get("per_page") ?? 15) || 15;
  if (perPage < 1 || perPage > 100)
    throw new ApiError(422, "The per page may not be greater than 100.");

  const scope = store.entries.filter((e) =>
    competitionId
      ? e.competition_uuid === competitionId
      : competitionIds.includes(e.competition_uuid),
  );
  const q = (query.get("q") ?? "").trim();
  const needle = q.toLowerCase();
  const rows = scope
    .filter(
      (e) =>
        (!eligibility || e.eligibility_status === eligibility) &&
        (!payment || e.payment_status === payment) &&
        (!checkin || e.checkin_status === checkin) &&
        (!status || e.status === status),
    )
    .map((e) => entryRecord(e, caller))
    .filter(
      (e) =>
        !q ||
        e.participant_code === q ||
        [e.pet_name, e.owner_name, e.bib_number].some((v) =>
          v?.toLowerCase().includes(needle),
        ),
    )
    .sort(
      (a, b) =>
        compareNullable(a[sort], b[sort]) * (direction === "asc" ? 1 : -1) ||
        a.uuid.localeCompare(b.uuid),
    );
  return {
    items: rows.slice((page - 1) * perPage, page * perPage),
    meta: {
      current_page: page,
      per_page: perPage,
      total: rows.length,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
    },
    summary: entrySummary(scope),
  };
}

/** `GET /events/{uuid}/owner-search` (contract 10 §2.5). */
export function searchOwners(
  eventUuid: string,
  rawQ: string,
  caller: MockCaller,
): { items: ApiOwnerSearchResult[] } {
  findOrThrow(store.events, eventUuid, "Event");
  forbidUnless(
    caller.managesEvent &&
      hasPermission(caller, PERMISSION.REGISTRATION_APPROVE),
  );
  const q = rawQ.trim().toLowerCase();
  if (q.length < 2) return { items: [] };
  const owners = store.users
    .filter(
      (u) =>
        u.status.toUpperCase() === "ACTIVE" &&
        [u.first_name, u.last_name, u.username, u.email, u.phone].some((v) =>
          v?.toLowerCase().includes(q),
        ),
    )
    .slice(0, 10);
  return {
    items: owners.map((u) => ({
      uuid: u.uuid,
      name: fullName(u),
      email: u.email,
      // Contract 10 §2.5 types these as plain strings; the mock has no nulls to send.
      phone: u.phone ?? null,
      pets: store.pets
        .filter((p) => p.owner_uuid === u.uuid)
        .map((p) => ({
          uuid: p.uuid,
          name: p.name,
          species_name:
            store.species.find((s) => s.uuid === p.species_uuid)?.name ?? "",
          morph_name:
            store.petMorphs.find((m) => m.uuid === p.morph_uuid)?.name ?? null,
        })),
    })),
  };
}

/** Next `PTC-{competition}-{seq}` code, like the backend `nextParticipantCode`. */
function nextParticipantCode(competition: MockCompetition): string {
  const own = store.entries.filter(
    (e) => e.competition_uuid === competition.uuid,
  );
  const prefix =
    own
      .find((e) => e.participant_code)
      ?.participant_code?.replace(/-\d+$/, "") ??
    `PTC-${store.competitions.indexOf(competition) + 1}`;
  let sequence = own.length;
  let code: string;
  do {
    code = `${prefix}-${String(++sequence).padStart(3, "0")}`;
  } while (store.entries.some((e) => e.participant_code === code));
  return code;
}

/**
 * `POST /competitions/{uuid}/entries` (contract 10 §2.4): by the pet's owner
 * or by event staff on the owner's behalf. Order: 403, window, duplicate, period.
 */
export function createEntry(
  competitionUuid: string,
  body: Record<string, unknown> | undefined,
  actor: MockUser,
  now = new Date(),
): MockEntry {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const pet = store.pets.find((p) => p.uuid === body?.pet_id);
  if (!pet) throw new ApiError(422, "The selected pet is invalid.");
  const caller = callerFor(actor, competition.event_uuid);
  forbidUnless(
    pet.owner_uuid === actor.uuid ||
      (caller.managesEvent &&
        hasPermission(caller, PERMISSION.REGISTRATION_APPROVE)),
  );
  const window = registrationWindowOf(competition, now);
  if (window.closedReason)
    throw new ApiError(422, REGISTRATION_CLOSED_MESSAGE[window.closedReason]);
  if (
    store.entries.some(
      (e) =>
        e.competition_uuid === competition.uuid &&
        e.pet_uuid === pet.uuid &&
        e.status === "REGISTERED",
    )
  )
    throw new ApiError(422, "This pet is already entered in this competition.");
  const requested = body?.registration_period_id;
  if (requested && requested !== window.activePeriod?.uuid)
    throw new ApiError(
      422,
      "The selected registration period is not open for this competition.",
    );
  const period = window.activePeriod;
  const entry: MockEntry = {
    uuid: crypto.randomUUID(),
    participant_code: nextParticipantCode(competition),
    competition_uuid: competition.uuid,
    owner_uuid: pet.owner_uuid,
    pet_uuid: pet.uuid,
    team_uuid: null,
    registration_period_uuid: period?.uuid ?? null,
    bib_number: null,
    registration_fee: period?.price ?? 0,
    eligibility_status: "PENDING",
    payment_status: "UNPAID",
    checkin_status: "NOT_CHECKED_IN",
    status: "REGISTERED",
    registered_at: iso(now),
    checked_in_at: null,
    registered_by_uuid: actor.uuid,
  };
  store.entries.push(entry);
  return entry;
}
