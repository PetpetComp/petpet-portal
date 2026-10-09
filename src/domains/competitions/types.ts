/** How a competition type produces results (backend `competition_types.result_mode`). */
export type ResultMode =
  "TIME" | "POSITION" | "CHECKPOINT" | "JUDGED_SCORE" | "COMBINED";

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
  status: string;
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
  status: string;
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
    status: row.status,
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
