import { ApiError } from "@/lib/api-client";
import {
  store,
  paginate,
  findOrThrow,
  nextUuid,
  DEMO_PASSWORD,
} from "./mock-store";
import type { MockCompetition, MockEntry, MockUser } from "./mock-types";
import { mockAccess } from "./mock-access";
import type { ApiCompetitionActions } from "@/domains/competitions/types";
import type { ApiEntryActions } from "@/domains/entries/types";
import {
  callerFor,
  competitionRecord,
  createEntry,
  entryRecord,
  guard,
  iso,
  listEventEntries,
  searchOwners,
} from "./mock-records";
import {
  UNRESTRICTED,
  competitionActions,
  entryActions,
  isEntryDrawn,
} from "./mock-rules";
import {
  closePeriodRecord,
  createCriterionRecord,
  createPeriodRecord,
  createRuleRecord,
  getCompetitionRecord,
  listCriterionRecords,
  listPeriodRecords,
  listRuleRecords,
  updateCompetitionRecord,
  updatePeriodRecord,
} from "./mock-competitions";
import {
  cancelEventRecord,
  createEventRecord,
  eventRecord,
  listEventRecords,
  publishEventRecord,
  updateEventRecord,
} from "./mock-events";
import {
  createInvitationRecord,
  listAssignmentRoles,
  listCompetitionStaff,
  listEventStaff,
  listInvitations,
  revokeAssignmentRecord,
  revokeInvitationRecord,
} from "./mock-staff";
import {
  addBrandPicRecord,
  createBrandRecord,
  deactivateBrandRecord,
  getBrandRecord,
  listBrandRecords,
  removeBrandPicRecord,
  updateBrandRecord,
} from "./mock-brands";
import {
  acceptInvitationRecord,
  approveApplicationRecord,
  approveVerificationRecord,
  cancelApplicationRecord,
  changeMemberRoleRecord,
  createOrganizationInvitationRecord,
  createOrganizationRecord,
  declineInvitationRecord,
  getOrganizationRecord,
  listApplicationRecords,
  listMemberRecords,
  listMyApplicationRecords,
  listOrganizationInvitationRecords,
  listOrganizationRecords,
  listOrganizationVerificationRecords,
  listVerificationQueueRecords,
  lookupInvitationRecord,
  rejectApplicationRecord,
  rejectVerificationRecord,
  removeMemberRecord,
  revokeOrganizationInvitationRecord,
  submitApplicationRecord,
  submitVerificationRecord,
  updateOrganizationRecord,
} from "./mock-organizations";
import {
  addEventSponsorRecord,
  listEventSponsorRecords,
  removeEventSponsorRecord,
} from "./mock-sponsors";
import {
  assignRoleRecord,
  createUserRecord,
  deactivateUserRecord,
  getUserRecord,
  listCityRecords,
  listCountryRecords,
  listPermissionRecords,
  listProvinceRecords,
  listRoleRecords,
  listUserRecords,
  normalizedStatus,
  revokeRoleRecord,
  updateUserRecord,
} from "./mock-users";
import {
  createPetRecord,
  deletePetRecord,
  getPetRecord,
  listPetMorphRecords,
  listPetRecords,
  updatePetRecord,
} from "./mock-pets";

import {
  getDrawingRecord,
  invalidateDrawing,
  lockDrawingRecord,
  swapDrawingRecord,
} from "./mock-drawing";
import { getResultsRecord, verifyResultsRecord } from "./mock-results";
import {
  assignFinishRecord,
  captureFinishRecord,
  confirmMatchRecord,
  createPenaltyRecord,
  createSessionRecord,
  getMatchRecord,
  listMatchesRecord,
  revokePenaltyRecord,
  startSessionRecord,
  stopSessionRecord,
  updateHeatEntryRecord,
  voidFinishRecord,
} from "./mock-matches";
import {
  createAttemptRecord,
  createPenaltyRecord as createTimeTrialPenaltyRecord,
  getAttemptRecord,
  getQueueRecord,
  isTimeTrialEntry,
  isTimeTrialPenalty,
  recordTimerResultRecord,
  revokePenaltyRecord as revokeTimeTrialPenaltyRecord,
  skipParticipantRecord,
  startAttemptRecord,
  stopAttemptRecord,
  updateAttemptStatusRecord,
  updateRoundEntryRecord,
} from "./mock-timetrial";
import {
  createScorecardRecord,
  getJudgingRecord,
  getScorecardRecord,
  listRoundScorecardsRecord,
  lockScorecardRecord,
  putCriterionScoresRecord,
  updateScorecardRecord,
} from "./mock-judging";

function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index++) {
    const segment = patternSegments[index];
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = decodeURIComponent(pathSegments[index]);
    } else if (segment !== pathSegments[index]) {
      return null;
    }
  }
  return params;
}

function userRecord(user: MockUser) {
  return {
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name ?? null,
    phone: user.phone ?? null,
    status: normalizedStatus(user),
    ...mockAccess(user),
  };
}

let currentSessionUserUuid: string | null = null;

function requireSession(): MockUser {
  if (!currentSessionUserUuid)
    throw new ApiError(401, "Session expired. Please sign in again.");
  return findOrThrow(store.users, currentSessionUserUuid, "User");
}

/** Runs one lifecycle action through the same rule as `actions` (backend `CompetitionActions`). */
function competitionAction(
  uuid: string,
  action: keyof ApiCompetitionActions,
  apply: (competition: MockCompetition) => void,
  message: string,
) {
  const user = requireSession();
  const competition = findOrThrow(store.competitions, uuid, "Competition");
  const event = findOrThrow(store.events, competition.event_uuid, "Event");
  const caller = callerFor(user, competition.event_uuid);
  guard(
    competitionActions(competition, event.status, caller)[action],
    competitionActions(competition, event.status, UNRESTRICTED)[action],
    message,
  );
  apply(competition);
  return competitionRecord(competition, caller);
}

/** Runs one entry action through the same rule as `actions` (backend `EntryActions`). */
function entryAction(
  uuid: string,
  action: keyof ApiEntryActions,
  apply: (entry: MockEntry) => void,
  message: string,
) {
  const user = requireSession();
  const entry = findOrThrow(store.entries, uuid, "Entry");
  const competition = findOrThrow(
    store.competitions,
    entry.competition_uuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  guard(
    entryActions(entry, competition.status, caller, isEntryDrawn(entry.uuid))[
      action
    ],
    entryActions(
      entry,
      competition.status,
      UNRESTRICTED,
      isEntryDrawn(entry.uuid),
    )[action],
    message,
  );
  apply(entry);
  return entryRecord(entry, caller);
}

type Route = {
  method: string;
  pattern: string;
  handler: (
    params: Record<string, string>,
    body: Record<string, unknown> | undefined,
    query: URLSearchParams,
  ) => unknown;
};

const routes: Route[] = [
  {
    method: "POST",
    pattern: "/auth/login",
    handler: (_params, body) => {
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(body?.password ?? "");
      const user = store.users.find(
        (item) => item.email.toLowerCase() === email,
      );
      if (!user || user.password !== password)
        throw new ApiError(401, "Invalid email or password.");
      currentSessionUserUuid = user.uuid;
      return {
        access_token: "mock." + nextUuid(),
        token_type: "Bearer",
        expires_in: 60 * 60 * 8,
        user: userRecord(user),
      };
    },
  },
  {
    method: "POST",
    pattern: "/auth/register",
    handler: (_params, body) => {
      const email = String(body?.email ?? "")
        .trim()
        .toLowerCase();
      if (store.users.some((item) => item.email.toLowerCase() === email))
        throw new ApiError(422, "That email is already registered.");
      const user: MockUser = {
        uuid: nextUuid(),
        username: String(body?.username ?? email.split("@")[0]),
        email,
        password: String(body?.password ?? DEMO_PASSWORD),
        first_name: String(body?.first_name ?? "New"),
        last_name: body?.last_name ? String(body.last_name) : undefined,
        status: "Active",
      };
      store.users.push(user);
      currentSessionUserUuid = user.uuid;
      return {
        access_token: "mock." + nextUuid(),
        token_type: "Bearer",
        expires_in: 60 * 60 * 8,
        user: userRecord(user),
      };
    },
  },
  {
    method: "GET",
    pattern: "/auth/me",
    handler: () => userRecord(requireSession()),
  },
  {
    method: "POST",
    pattern: "/auth/logout",
    handler: () => {
      currentSessionUserUuid = null;
      return null;
    },
  },
  // Users, role, permission, wilayah: aturan di mock-users.ts (kontrak users).
  { method: "GET", pattern: "/auth/roles", handler: () => listRoleRecords() },
  {
    method: "GET",
    pattern: "/auth/permissions",
    handler: () => listPermissionRecords(requireSession()),
  },
  {
    method: "GET",
    pattern: "/master/countries",
    handler: () => listCountryRecords(),
  },
  {
    method: "GET",
    pattern: "/master/provinces",
    handler: (_params, _body, query) => listProvinceRecords(query),
  },
  {
    method: "GET",
    pattern: "/master/cities",
    handler: (_params, _body, query) => listCityRecords(query),
  },
  {
    method: "GET",
    pattern: "/users",
    handler: (_params, _body, query) =>
      listUserRecords(requireSession(), query),
  },
  {
    method: "POST",
    pattern: "/users",
    handler: (_params, body) => createUserRecord(requireSession(), body),
  },
  {
    method: "GET",
    pattern: "/users/:uuid",
    handler: (params) => getUserRecord(requireSession(), params.uuid),
  },
  {
    method: "PATCH",
    pattern: "/users/:uuid",
    handler: (params, body) =>
      updateUserRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/users/:uuid",
    handler: (params) => deactivateUserRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/users/:uuid/roles",
    handler: (params, body) =>
      assignRoleRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/users/:uuid/roles/:code",
    handler: (params) =>
      revokeRoleRecord(requireSession(), params.uuid, params.code),
  },
  {
    method: "GET",
    // Pet: aturan di mock-pets.ts (kontrak pets). Butuh login seperti `jwt.auth` di backend.
    pattern: "/pets",
    handler: (_params, _body, query) => listPetRecords(requireSession(), query),
  },
  {
    method: "GET",
    pattern: "/pets/:uuid",
    handler: (params) => getPetRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/pets",
    handler: (_params, body) => createPetRecord(requireSession(), body),
  },
  {
    method: "PATCH",
    pattern: "/pets/:uuid",
    handler: (params, body) =>
      updatePetRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/pets/:uuid",
    handler: (params) => deletePetRecord(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/master/pet-morphs",
    handler: (_params, _body, query) => listPetMorphRecords(query),
  },
  // Organizations (draf kontrak organizations): aturannya ada di mock-organizations.ts.
  {
    method: "GET",
    pattern: "/organizations",
    handler: (_params, _body, query) => listOrganizationRecords(query),
  },
  {
    method: "POST",
    pattern: "/organizations",
    handler: (_params, body) =>
      createOrganizationRecord(requireSession(), body),
  },
  {
    method: "GET",
    pattern: "/organizations/:uuid",
    handler: (params) => getOrganizationRecord(params.uuid),
  },
  {
    method: "PATCH",
    pattern: "/organizations/:uuid",
    handler: (params, body) =>
      updateOrganizationRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/organizations/:uuid/members",
    handler: (params) => listMemberRecords(requireSession(), params.uuid),
  },
  {
    method: "PATCH",
    pattern: "/organizations/:uuid/members/:userUuid",
    handler: (params, body) =>
      changeMemberRoleRecord(
        requireSession(),
        params.uuid,
        params.userUuid,
        body,
      ),
  },
  {
    method: "DELETE",
    pattern: "/organizations/:uuid/members/:userUuid",
    handler: (params) =>
      removeMemberRecord(requireSession(), params.uuid, params.userUuid),
  },
  {
    method: "POST",
    pattern: "/organizations/:uuid/invitations",
    handler: (params, body) =>
      createOrganizationInvitationRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/organizations/:uuid/invitations",
    handler: (params) =>
      listOrganizationInvitationRecords(requireSession(), params.uuid),
  },
  {
    method: "DELETE",
    pattern: "/organizations/:uuid/invitations/:invitationUuid",
    handler: (params) =>
      revokeOrganizationInvitationRecord(
        requireSession(),
        params.uuid,
        params.invitationUuid,
      ),
  },
  {
    method: "POST",
    pattern: "/organizations/:uuid/verifications",
    handler: (params, body) =>
      submitVerificationRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/organizations/:uuid/verifications",
    handler: (params) =>
      listOrganizationVerificationRecords(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/verifications",
    handler: (_params, _body, query) =>
      listVerificationQueueRecords(requireSession(), query),
  },
  {
    method: "POST",
    pattern: "/verifications/:uuid/approve",
    handler: (params) =>
      approveVerificationRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/verifications/:uuid/reject",
    handler: (params, body) =>
      rejectVerificationRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/invitations/:token",
    handler: (params) => lookupInvitationRecord(params.token),
  },
  {
    method: "POST",
    pattern: "/invitations/:token/accept",
    handler: (params) => acceptInvitationRecord(requireSession(), params.token),
  },
  {
    method: "POST",
    pattern: "/invitations/:token/decline",
    handler: (params) =>
      declineInvitationRecord(requireSession(), params.token),
  },
  {
    method: "GET",
    pattern: "/events",
    handler: (_params, _body, query) => listEventRecords(query),
  },
  {
    method: "GET",
    pattern: "/events/:uuid",
    handler: (params) =>
      eventRecord(findOrThrow(store.events, params.uuid, "Event")),
  },
  {
    method: "POST",
    pattern: "/events",
    handler: (_params, body) => createEventRecord(requireSession(), body),
  },
  {
    method: "PATCH",
    pattern: "/events/:uuid",
    handler: (params, body) =>
      updateEventRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/events/:uuid",
    handler: (params) => cancelEventRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/publish",
    handler: (params) => publishEventRecord(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/events/:uuid/competitions",
    handler: (params, _body, query) => {
      const caller = callerFor(currentMockUser(), params.uuid);
      return paginate(
        store.competitions
          .filter((item) => item.event_uuid === params.uuid)
          .map((item) => competitionRecord(item, caller)),
        query,
      );
    },
  },
  {
    method: "GET",
    pattern: "/events/:uuid/entries",
    handler: (params, _body, query) =>
      listEventEntries(
        params.uuid,
        query,
        callerFor(requireSession(), params.uuid),
      ),
  },
  {
    method: "GET",
    pattern: "/events/:uuid/owner-search",
    handler: (params, _body, query) =>
      searchOwners(
        params.uuid,
        query.get("q") ?? "",
        callerFor(requireSession(), params.uuid),
      ),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/competitions",
    handler: (params, body) => {
      const optional = (key: string) =>
        body?.[key] == null ? undefined : String(body[key]);
      const competition: MockCompetition = {
        uuid: nextUuid(),
        event_uuid: params.uuid,
        name: String(body?.name ?? ""),
        description: optional("description"),
        arena_name: optional("arena_name"),
        capacity: body?.capacity == null ? undefined : Number(body.capacity),
        minimum_judges:
          body?.minimum_judges == null
            ? undefined
            : Number(body.minimum_judges),
        // The real API answers with *_uuid keys for what it receives as *_id.
        competition_type_uuid: String(body?.competition_type_id ?? ""),
        species_uuid: optional("species_id"),
        scheduled_start_at: String(body?.scheduled_start_at ?? ""),
        scheduled_end_at: String(body?.scheduled_end_at ?? ""),
        registration_closed_at: null,
        status: "DRAFT",
      };
      store.competitions.push(competition);
      return competitionRecord(
        competition,
        callerFor(currentMockUser(), params.uuid),
      );
    },
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid",
    handler: (params) => getCompetitionRecord(currentMockUser(), params.uuid),
  },
  {
    method: "PATCH",
    pattern: "/competitions/:uuid",
    handler: (params, body) =>
      updateCompetitionRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/publish",
    handler: (params) =>
      competitionAction(
        params.uuid,
        "publish",
        (c) => (c.status = "SCHEDULED"),
        "Only draft competitions of an active event can be published.",
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/start",
    handler: (params) =>
      competitionAction(
        params.uuid,
        "start",
        (c) => (c.status = "ONGOING"),
        "Only scheduled competitions can be started.",
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/complete",
    handler: (params) =>
      competitionAction(
        params.uuid,
        "complete",
        (c) => (c.status = "COMPLETED"),
        "Only ongoing competitions can be completed.",
      ),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/close-registration",
    handler: (params) =>
      competitionAction(
        params.uuid,
        "close_registration",
        (c) => (c.registration_closed_at = iso(new Date())),
        "Registration is already closed or the competition is not scheduled.",
      ),
  },
  {
    // MOCK ONLY (contract 13 section 9): the real backend has no reopen endpoint yet.
    // Reopening also deletes the competition's locked drawing (draft contract drawing, D6).
    method: "POST",
    pattern: "/competitions/:uuid/reopen-registration",
    handler: (params) =>
      competitionAction(
        params.uuid,
        "reopen_registration",
        (c) => {
          c.registration_closed_at = null;
          invalidateDrawing(c.uuid);
        },
        "Registration can only be reopened for a scheduled competition that was closed.",
      ),
  },
  {
    method: "DELETE",
    pattern: "/competitions/:uuid",
    // Cancels: the row stays so the list can show it as Cancelled.
    handler: (params) => {
      competitionAction(
        params.uuid,
        "cancel",
        (c) => (c.status = "CANCELLED"),
        "Completed or cancelled competitions cannot be cancelled.",
      );
      return null;
    },
  },
  // Drawing (draf kontrak drawing, MOCK ONLY): aturannya ada di mock-drawing.ts.
  {
    method: "GET",
    pattern: "/competitions/:uuid/drawing",
    handler: (params) => getDrawingRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/drawing",
    handler: (params, body) =>
      lockDrawingRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/drawing/swap",
    handler: (params, body) =>
      swapDrawingRecord(requireSession(), params.uuid, body),
  },
  // Results (draf kontrak results, MOCK ONLY): aturannya ada di mock-results.ts.
  {
    method: "GET",
    pattern: "/competitions/:uuid/results",
    handler: (params) => getResultsRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/results/verify",
    handler: (params) => verifyResultsRecord(requireSession(), params.uuid),
  },
  // Run Match (kontrak 13 bagian 13, MOCK ONLY sebagian): aturannya ada di mock-matches.ts.
  {
    method: "GET",
    pattern: "/competitions/:uuid/matches",
    handler: (params) => listMatchesRecord(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/matches/:uuid",
    handler: (params) => getMatchRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/heats/:uuid/sessions",
    handler: (params, body) =>
      createSessionRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/heats/:uuid/confirm",
    handler: (params, body) =>
      confirmMatchRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/sessions/:uuid/start",
    handler: (params) => startSessionRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/sessions/:uuid/stop",
    handler: (params, body) =>
      stopSessionRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/sessions/:uuid/finishes",
    handler: (params, body) =>
      captureFinishRecord(requireSession(), params.uuid, body),
  },
  {
    method: "PATCH",
    pattern: "/finishes/:uuid/assign",
    handler: (params, body) =>
      assignFinishRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/finishes/:uuid/void",
    handler: (params) => voidFinishRecord(requireSession(), params.uuid),
  },
  {
    method: "PATCH",
    pattern: "/heat-entries/:uuid",
    handler: (params, body) =>
      updateHeatEntryRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/penalties",
    // Peserta antrean Time trial ditangani mock-timetrial.ts, sisanya Run Match.
    handler: (params, body) =>
      isTimeTrialEntry(params.uuid)
        ? createTimeTrialPenaltyRecord(requireSession(), params.uuid, body)
        : createPenaltyRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/penalties/:uuid/revoke",
    handler: (params) =>
      isTimeTrialPenalty(params.uuid)
        ? revokeTimeTrialPenaltyRecord(requireSession(), params.uuid)
        : revokePenaltyRecord(requireSession(), params.uuid),
  },
  // Time trial (kontrak 14, MOCK ONLY sebagian): aturannya ada di mock-timetrial.ts.
  {
    method: "GET",
    pattern: "/competitions/:uuid/queue",
    handler: (params) => getQueueRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/queue/:entryUuid/skip",
    handler: (params) =>
      skipParticipantRecord(requireSession(), params.uuid, params.entryUuid),
  },
  {
    method: "POST",
    pattern: "/rounds/:uuid/attempts",
    handler: (params, body) =>
      createAttemptRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/attempts/:uuid",
    handler: (params) => getAttemptRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/attempts/:uuid/start",
    handler: (params) => startAttemptRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/attempts/:uuid/stop",
    handler: (params) => stopAttemptRecord(requireSession(), params.uuid),
  },
  {
    method: "PATCH",
    pattern: "/attempts/:uuid/status",
    handler: (params, body) =>
      updateAttemptStatusRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/attempts/:uuid/timer-result",
    handler: (params, body) =>
      recordTimerResultRecord(requireSession(), params.uuid, body),
  },
  {
    method: "PATCH",
    pattern: "/round-entries/:uuid",
    handler: (params, body) =>
      updateRoundEntryRecord(requireSession(), params.uuid, body),
  },
  // Judging Contest (kontrak 15, MOCK ONLY sebagian): aturannya ada di mock-judging.ts.
  {
    method: "GET",
    pattern: "/competitions/:uuid/judging",
    handler: (params) => getJudgingRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/rounds/:uuid/scorecards",
    handler: (params, body) =>
      createScorecardRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/rounds/:uuid/scorecards",
    handler: (params) =>
      listRoundScorecardsRecord(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/scorecards/:uuid",
    handler: (params) => getScorecardRecord(requireSession(), params.uuid),
  },
  {
    method: "PUT",
    pattern: "/scorecards/:uuid/criterion-scores",
    handler: (params, body) =>
      putCriterionScoresRecord(requireSession(), params.uuid, body),
  },
  {
    method: "PATCH",
    pattern: "/scorecards/:uuid",
    handler: (params, body) =>
      updateScorecardRecord(requireSession(), params.uuid, body),
  },
  {
    method: "POST",
    pattern: "/scorecards/:uuid/lock",
    handler: (params) => lockScorecardRecord(requireSession(), params.uuid),
  },
  // Committee (kontrak 13 bagian 3): aturannya ada di mock-staff.ts.
  {
    method: "GET",
    pattern: "/staff-invitations",
    handler: (_params, _body, query) =>
      listInvitations(requireSession(), query),
  },
  {
    method: "POST",
    pattern: "/staff-invitations",
    handler: (_params, body) => createInvitationRecord(requireSession(), body),
  },
  {
    method: "DELETE",
    pattern: "/staff-invitations/:uuid",
    handler: (params) => revokeInvitationRecord(requireSession(), params.uuid),
  },
  {
    method: "DELETE",
    pattern: "/staff-assignments/:uuid",
    handler: (params) => revokeAssignmentRecord(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/master/assignment-roles",
    // Data master dikirim sebagai array datar, seperti master lain.
    handler: () => listAssignmentRoles(),
  },
  {
    method: "POST",
    pattern: "/organizer-applications",
    handler: (_params, body) => submitApplicationRecord(requireSession(), body),
  },
  {
    method: "GET",
    pattern: "/organizer-applications/me",
    handler: () => listMyApplicationRecords(requireSession()),
  },
  {
    method: "GET",
    pattern: "/organizer-applications",
    handler: (_params, _body, query) =>
      listApplicationRecords(requireSession(), query),
  },
  {
    method: "DELETE",
    pattern: "/organizer-applications/:uuid",
    handler: (params) => cancelApplicationRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/organizer-applications/:uuid/approve",
    handler: (params) =>
      approveApplicationRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/organizer-applications/:uuid/reject",
    handler: (params, body) =>
      rejectApplicationRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/master/competition-types",
    // The real API returns master data as a plain array, not a page.
    handler: () => store.competitionTypes,
  },
  {
    method: "GET",
    pattern: "/master/species",
    handler: () => store.species,
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/registration-periods",
    handler: (params) => listPeriodRecords(params.uuid),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/registration-periods",
    handler: (params, body) =>
      createPeriodRecord(requireSession(), params.uuid, body),
  },
  {
    method: "PATCH",
    pattern: "/registration-periods/:uuid",
    handler: (params, body) =>
      updatePeriodRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/registration-periods/:uuid",
    handler: (params) => closePeriodRecord(requireSession(), params.uuid),
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/rules",
    handler: (params) => listRuleRecords(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/rules",
    handler: (params, body) =>
      createRuleRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/score-criteria",
    handler: (params) => listCriterionRecords(params.uuid),
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/score-criteria",
    handler: (params, body) =>
      createCriterionRecord(requireSession(), params.uuid, body),
  },
  {
    method: "GET",
    pattern: "/events/:uuid/staff",
    handler: (params, _body, query) =>
      listEventStaff(requireSession(), params.uuid, query),
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/staff",
    handler: (params, _body, query) =>
      listCompetitionStaff(requireSession(), params.uuid, query),
  },
  {
    method: "GET",
    pattern: "/sponsors",
    handler: (_params, _body, query) => listBrandRecords(query),
  },
  {
    method: "GET",
    pattern: "/sponsors/:uuid",
    handler: (params) => getBrandRecord(params.uuid),
  },
  {
    method: "POST",
    pattern: "/sponsors",
    handler: (_params, body) => createBrandRecord(requireSession(), body),
  },
  {
    method: "PATCH",
    pattern: "/sponsors/:uuid",
    handler: (params, body) =>
      updateBrandRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/sponsors/:uuid",
    handler: (params) => deactivateBrandRecord(requireSession(), params.uuid),
  },
  {
    method: "POST",
    pattern: "/sponsors/:uuid/pics",
    handler: (params, body) =>
      addBrandPicRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/sponsors/:uuid/pics/:userId",
    handler: (params) =>
      removeBrandPicRecord(requireSession(), params.uuid, params.userId),
  },
  // Sponsor event: aturan di mock-sponsors.ts (kontrak 13 bagian 4). GET mengembalikan array datar.
  {
    method: "GET",
    pattern: "/events/:uuid/sponsors",
    handler: (params) => listEventSponsorRecords(params.uuid),
  },
  {
    method: "POST",
    pattern: "/events/:uuid/sponsors",
    handler: (params, body) =>
      addEventSponsorRecord(requireSession(), params.uuid, body),
  },
  {
    method: "DELETE",
    pattern: "/events/:eventId/sponsors/:linkId",
    handler: (params) =>
      removeEventSponsorRecord(requireSession(), params.eventId, params.linkId),
  },
  {
    method: "GET",
    pattern: "/competitions/:uuid/entries",
    handler: (params, _body, query) => {
      const competition = findOrThrow(
        store.competitions,
        params.uuid,
        "Competition",
      );
      const caller = callerFor(requireSession(), competition.event_uuid);
      return paginate(
        store.entries
          .filter((item) => item.competition_uuid === params.uuid)
          .map((entry) => entryRecord(entry, caller)),
        query,
      );
    },
  },
  {
    method: "POST",
    pattern: "/competitions/:uuid/entries",
    handler: (params, body) => {
      const actor = requireSession();
      const entry = createEntry(params.uuid, body, actor);
      const competition = findOrThrow(
        store.competitions,
        entry.competition_uuid,
        "Competition",
      );
      return entryRecord(entry, callerFor(actor, competition.event_uuid));
    },
  },
  {
    method: "DELETE",
    pattern: "/entries/:uuid",
    handler: (params) => {
      // Keputusan 0A: entry di drawing terkunci tidak boleh dihapus; tandai DNS di match-nya.
      if (isEntryDrawn(params.uuid))
        throw new ApiError(
          422,
          "This participant is in a locked drawing; mark it as did not start in its match instead.",
        );
      store.entries = store.entries.filter((item) => item.uuid !== params.uuid);
      return null;
    },
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/approve",
    handler: (params) =>
      entryAction(
        params.uuid,
        "approve",
        (e) => (e.eligibility_status = "APPROVED"),
        "Only pending registrations can be approved.",
      ),
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/reject",
    handler: (params) =>
      entryAction(
        params.uuid,
        "reject",
        (e) => (e.eligibility_status = "REJECTED"),
        "Only pending registrations can be rejected.",
      ),
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/mark-paid",
    handler: (params) =>
      entryAction(
        params.uuid,
        "mark_paid",
        (e) => (e.payment_status = "PAID"),
        "Only unpaid registrations that were not rejected can be marked as paid.",
      ),
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/checkin",
    handler: (params) =>
      entryAction(
        params.uuid,
        "check_in",
        (e) => {
          e.checkin_status = "CHECKED_IN";
          e.checked_in_at = iso(new Date());
        },
        "Only approved and paid participants of a scheduled or ongoing competition can check in.",
      ),
  },
  {
    method: "POST",
    pattern: "/entries/:uuid/undo-checkin",
    handler: (params) =>
      entryAction(
        params.uuid,
        "undo_check_in",
        (e) => {
          e.checkin_status = "NOT_CHECKED_IN";
          e.checked_in_at = null;
        },
        "Check-in can only be undone before the competition starts and before the drawing is locked.",
      ),
  },
];

export function currentMockUser(): MockUser | null {
  return currentSessionUserUuid
    ? (store.users.find((item) => item.uuid === currentSessionUserUuid) ?? null)
    : null;
}

export { routes as mockRoutes, matchPath, requireSession };

export async function mockRequest<T>(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const [path, search] = endpoint.split("?");
  const query = new URLSearchParams(search ?? "");
  const route = routes.find(
    (candidate) =>
      candidate.method === method &&
      matchPath(candidate.pattern, path) !== null,
  );
  if (!route) throw new ApiError(404, "Not available in demo mode.");
  const params = matchPath(route.pattern, path) ?? {};
  const data = route.handler(params, body, query);
  return { success: true, message: "OK", data } as T;
}
