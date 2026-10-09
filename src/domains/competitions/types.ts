export interface Competition {
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
}

export type ApiCompetition = Record<string, unknown> & { uuid: string };

const text = (value: unknown) => (value == null ? "" : String(value));

export function fromApi(row: ApiCompetition): Competition {
  return {
    id: row.uuid,
    eventId: text(row.event_uuid),
    typeId: text(row.competition_type_uuid),
    name: text(row.name),
    arenaName: text(row.arena_name),
    capacity: row.capacity == null ? null : Number(row.capacity),
    startAt: text(row.scheduled_start_at),
    endAt: text(row.scheduled_end_at),
    registrationClosed: row.registration_closed_at != null,
    status: text(row.status),
  };
}

/** How a competition type produces results (backend `competition_types.result_mode`). */
export type ResultMode =
  "TIME" | "POSITION" | "CHECKPOINT" | "JUDGED_SCORE" | "COMBINED";

export interface CompetitionType {
  id: string;
  code: string;
  name: string;
  resultMode: ResultMode;
}

export interface Species {
  id: string;
  name: string;
}

export const typeFromApi = (row: ApiCompetition): CompetitionType => ({
  id: row.uuid,
  code: text(row.code),
  name: text(row.name),
  resultMode: text(row.result_mode) as ResultMode,
});

export const speciesFromApi = (row: ApiCompetition): Species => ({
  id: row.uuid,
  name: text(row.name),
});
