import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows } from "@/services/common";
import type { ApiResponse } from "@/types/common";
import type {
  CompetitionPayload,
  CriterionPayload,
  ListResponse,
  MutationResponse,
  PeriodPayload,
} from "@/types/api";
import type { ApiCompetitionUpdate, NewCompetition } from "./schema";
import { PERIOD_LABEL, criterionCode, usesCriteria } from "./schema";
import type { SettingsChanges } from "./settings";
import {
  criterionFromApi,
  fromApi,
  periodFromApi,
  ruleFromApi,
  speciesFromApi,
  typeFromApi,
  type ApiCompetition,
  type ApiCompetitionRule,
  type ApiCompetitionType,
  type ApiPeriodUpdate,
  type ApiRegistrationPeriod,
  type ApiRuleBody,
  type ApiScoreCriterion,
  type ApiSpecies,
  type Competition,
  type CompetitionAction,
  type CompetitionRule,
  type CompetitionType,
  type RegistrationPeriod,
  type ResultMode,
  type ScoreCriterion,
  type Species,
} from "./types";

/** Events have a handful of competitions, so all of them are loaded at once. */
export async function listEventCompetitions(
  eventId: string,
): Promise<Competition[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiCompetition>>(
      buildUrl(ENDPOINTS.events.competitions(eventId), p),
    ),
  );
  return rows.map(fromApi);
}

/** One competition (`GET /competitions/{uuid}`). Header and every tab of the workspace read it. */
export async function getCompetition(id: string): Promise<Competition> {
  const response = await apiClient.get<ApiResponse<ApiCompetition>>(
    ENDPOINTS.competitions.detail(id),
  );
  return fromApi(response.data);
}

/** Saves the basics of a competition (`PATCH /competitions/{uuid}`, backend `UpdateRequest`). */
export async function updateCompetition(
  id: string,
  body: ApiCompetitionUpdate,
): Promise<Competition> {
  const response = await apiClient.patch<ApiResponse<ApiCompetition>>(
    ENDPOINTS.competitions.detail(id),
    body,
  );
  return fromApi(response.data);
}

/** Every rule version of a competition, oldest first (`GET /competitions/{uuid}/rules`, needs login). */
export async function listCompetitionRules(
  id: string,
): Promise<CompetitionRule[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiCompetitionRule>>(
      buildUrl(ENDPOINTS.competitions.rules(id), p),
    ),
  );
  return rows.map(ruleFromApi);
}

/** Creates the next rule version; the backend deactivates the older ones (`POST /competitions/{uuid}/rules`). */
export async function createCompetitionRule(
  id: string,
  body: ApiRuleBody,
): Promise<CompetitionRule> {
  const response = await apiClient.post<ApiResponse<ApiCompetitionRule>>(
    ENDPOINTS.competitions.rules(id),
    body,
  );
  return ruleFromApi(response.data);
}

/** All registration periods of a competition, closed ones included. */
export async function listRegistrationPeriods(
  id: string,
): Promise<RegistrationPeriod[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiRegistrationPeriod>>(
      buildUrl(ENDPOINTS.competitions.periods(id), p),
    ),
  );
  return rows.map(periodFromApi);
}

/** Adds a channel. The backend answers 422 when the competition already has one of that type. */
export async function createRegistrationPeriod(
  id: string,
  body: PeriodPayload,
): Promise<RegistrationPeriod> {
  const response = await apiClient.post<ApiResponse<ApiRegistrationPeriod>>(
    ENDPOINTS.competitions.periods(id),
    body,
  );
  return periodFromApi(response.data);
}

export async function updateRegistrationPeriod(
  periodId: string,
  body: ApiPeriodUpdate,
): Promise<RegistrationPeriod> {
  const response = await apiClient.patch<ApiResponse<ApiRegistrationPeriod>>(
    ENDPOINTS.periods.detail(periodId),
    body,
  );
  return periodFromApi(response.data);
}

/** DELETE does not remove the row: the backend sets its status to CLOSED and returns it. */
export async function closeRegistrationPeriod(
  periodId: string,
): Promise<RegistrationPeriod> {
  const response = await apiClient.delete<ApiResponse<ApiRegistrationPeriod>>(
    ENDPOINTS.periods.detail(periodId),
  );
  return periodFromApi(response.data);
}

/**
 * Saves what changed on the Settings tab: the new rule version first, then channel edits,
 * then new channels. One call per change (the API has no batch). A failed step does not stop
 * the next ones; the error lists every step that failed so the organizer sees what is left.
 * Called from `useSaveCompetitionSettings`.
 */
export async function saveCompetitionSettings(
  id: string,
  changes: SettingsChanges,
): Promise<void> {
  const failures: string[] = [];
  const attempt = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "unknown error";
      failures.push(`${what}: ${reason}`);
    }
  };
  if (changes.rule) {
    const body = changes.rule;
    await attempt("Rules", () => createCompetitionRule(id, body));
  }
  for (const update of changes.periodUpdates)
    await attempt(PERIOD_LABEL[update.type], () =>
      updateRegistrationPeriod(update.id, update.body),
    );
  for (const body of changes.periodCreates)
    await attempt(
      PERIOD_LABEL[body.period_type as keyof typeof PERIOD_LABEL] ?? "Channel",
      () => createRegistrationPeriod(id, body),
    );
  if (failures.length > 0)
    throw new Error(`Some changes were not saved. ${failures.join(" ")}`);
}

/** Judging criteria of a competition, in display order (`GET /competitions/{uuid}/score-criteria`). */
export async function listScoreCriteria(id: string): Promise<ScoreCriterion[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiScoreCriterion>>(
      buildUrl(ENDPOINTS.competitions.criteria(id), p),
    ),
  );
  return rows.map(criterionFromApi);
}

/** Lifecycle actions. The server applies the same rules as `actions` (contract 10 §3). */
export function runCompetitionAction(id: string, action: CompetitionAction) {
  switch (action) {
    case "publish":
      return apiClient.post<ApiResponse<ApiCompetition>>(
        ENDPOINTS.competitions.publish(id),
      );
    case "start":
      return apiClient.post<ApiResponse<ApiCompetition>>(
        ENDPOINTS.competitions.start(id),
      );
    case "complete":
      return apiClient.post<ApiResponse<ApiCompetition>>(
        ENDPOINTS.competitions.complete(id),
      );
    case "closeRegistration":
      return apiClient.post<ApiResponse<ApiCompetition>>(
        ENDPOINTS.competitions.closeRegistration(id),
      );
    case "reopenRegistration":
      // Mock only: the backend has no such endpoint yet (contract 13 section 9).
      return apiClient.post<ApiResponse<ApiCompetition>>(
        ENDPOINTS.competitions.reopenRegistration(id),
      );
    case "cancel":
      return apiClient.delete<MutationResponse>(
        ENDPOINTS.competitions.detail(id),
      );
  }
}

export async function listCompetitionTypes(): Promise<CompetitionType[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiCompetitionType>>(
      buildUrl(ENDPOINTS.master.competitionTypes, p),
    ),
  );
  return rows.map(typeFromApi);
}

export async function listSpecies(): Promise<Species[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiSpecies>>(
      buildUrl(ENDPOINTS.master.species, p),
    ),
  );
  return rows.map(speciesFromApi);
}

/** The competition exists but a later setup step failed. */
export class CompetitionSetupError extends Error {
  constructor(
    message: string,
    readonly competitionId: string,
  ) {
    super(message);
  }
}

/**
 * Three calls, because the API has no single "create with periods and
 * criteria" endpoint (docs/09 §G). If step 2 or 3 fails, the competition is
 * already saved, so the error carries its id to finish setup from there.
 */
export async function createCompetition(
  eventId: string,
  v: NewCompetition,
): Promise<Competition> {
  const payload: CompetitionPayload = {
    competition_type_id: v.typeId,
    species_id: v.speciesId || undefined,
    name: v.name,
    arena_name: v.arenaName || null,
    capacity: v.capacity ?? null,
    scheduled_start_at: v.startAt,
    scheduled_end_at: v.endAt,
  };
  const created = await apiClient.post<ApiResponse<ApiCompetition>>(
    ENDPOINTS.events.competitions(eventId),
    payload,
  );
  const competition = fromApi(created.data);
  const step = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "unknown error";
      throw new CompetitionSetupError(
        `Competition saved, but ${what} failed: ${reason}`,
        competition.id,
      );
    }
  };
  await step("registration channels", async () => {
    for (const p of v.periods.filter((p) => p.enabled))
      await apiClient.post(ENDPOINTS.competitions.periods(competition.id), {
        period_type: p.type,
        price: p.price,
        quota: p.quota,
        registration_start_at: p.startAt,
        registration_end_at: p.endAt,
      } satisfies PeriodPayload);
  });
  if (usesCriteria(v.resultMode as ResultMode))
    await step("scoring criteria", async () => {
      for (const [i, c] of v.criteria.entries())
        await apiClient.post(ENDPOINTS.competitions.criteria(competition.id), {
          code: criterionCode(c.name, i),
          name: c.name,
          weight: c.weight,
          min_score: c.min,
          max_score: c.max,
          note_required: c.noteRequired,
          display_order: i,
        } satisfies CriterionPayload);
    });
  return competition;
}
