export interface Competition {
  id: string;
  eventId: string;
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
    name: text(row.name),
    arenaName: text(row.arena_name),
    capacity: row.capacity == null ? null : Number(row.capacity),
    startAt: text(row.scheduled_start_at),
    endAt: text(row.scheduled_end_at),
    registrationClosed: row.registration_closed_at != null,
    status: text(row.status),
  };
}
