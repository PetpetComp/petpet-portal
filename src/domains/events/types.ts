/** Backend values of `events.status`. The mock still uses title case ("Published"). */
export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** One event exactly as the API sends it (petpet-service `EventData::toArray`). */
export type ApiEvent = {
  uuid: string;
  organization_uuid: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  map_location: string | null;
  timezone: string;
  start_at: string;
  end_at: string;
  status: EventStatus;
};

/** An event as the screens use it. Built from `ApiEvent` by `fromApi` only. */
export type Event = {
  id: string;
  organizationId: string;
  name: string;
  tagline: string;
  venueName: string;
  venueAddress: string;
  startAt: string;
  endAt: string;
  status: string;
};

export function fromApi(row: ApiEvent): Event {
  return {
    id: row.uuid,
    organizationId: row.organization_uuid,
    name: row.name,
    tagline: row.tagline ?? "",
    venueName: row.venue_name ?? "",
    venueAddress: row.venue_address ?? "",
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
  };
}

export const isPublished = (event: Event) =>
  event.status.toUpperCase() === "PUBLISHED";
