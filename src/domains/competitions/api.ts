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
import type { NewCompetition } from "./schema";
import { criterionCode, usesCriteria } from "./schema";
import {
  fromApi,
  speciesFromApi,
  typeFromApi,
  type ApiCompetition,
  type ApiCompetitionType,
  type ApiSpecies,
  type Competition,
  type CompetitionAction,
  type CompetitionType,
  type ResultMode,
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
