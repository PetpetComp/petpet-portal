import { COMPETITION_SERVICES } from "@/services/competition";
import { MASTER_SERVICES } from "@/services/master";
import { collectRows } from "@/services/common";
import type { NewCompetition } from "./schema";
import { criterionCode, usesCriteria } from "./schema";
import {
  fromApi,
  speciesFromApi,
  typeFromApi,
  type ApiCompetition,
  type Competition,
  type CompetitionType,
  type ResultMode,
  type Species,
} from "./types";

/** Events have a handful of competitions, so all of them are loaded at once. */
export async function listEventCompetitions(
  eventId: string,
): Promise<Competition[]> {
  const rows = await collectRows<ApiCompetition>(
    (p) => COMPETITION_SERVICES.list(eventId, p) as never,
  );
  return rows.map(fromApi);
}

export async function listCompetitionTypes(): Promise<CompetitionType[]> {
  const rows = await collectRows<ApiCompetition>(
    (p) => MASTER_SERVICES.competitionTypes(p) as never,
  );
  return rows.map(typeFromApi);
}

export async function listSpecies(): Promise<Species[]> {
  const rows = await collectRows<ApiCompetition>(
    (p) => MASTER_SERVICES.species(p) as never,
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
  const created = await COMPETITION_SERVICES.create(eventId, {
    competition_type_id: v.typeId,
    species_id: v.speciesId || undefined,
    name: v.name,
    arena_name: v.arenaName || null,
    capacity: v.capacity ?? null,
    scheduled_start_at: v.startAt,
    scheduled_end_at: v.endAt,
  });
  const competition = fromApi(created.data as ApiCompetition);
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
      await COMPETITION_SERVICES.createPeriod(competition.id, {
        period_type: p.type,
        price: p.price,
        quota: p.quota,
        registration_start_at: p.startAt,
        registration_end_at: p.endAt,
      });
  });
  if (usesCriteria(v.resultMode as ResultMode))
    await step("scoring criteria", async () => {
      for (const [i, c] of v.criteria.entries())
        await COMPETITION_SERVICES.createCriterion(competition.id, {
          code: criterionCode(c.name, i),
          name: c.name,
          weight: c.weight,
          min_score: c.min,
          max_score: c.max,
          note_required: c.noteRequired,
          display_order: i,
        });
    });
  return competition;
}
