/** An event as the portal uses it. Built from the API row by `fromApi`. */
export interface Event {
  id: string;
  organizationId: string;
  name: string;
  tagline: string;
  venueName: string;
  venueAddress: string;
  startAt: string;
  endAt: string;
  status: string;
}

export type ApiEvent = Record<string, unknown> & { uuid: string };

const text = (value: unknown) => (value == null ? "" : String(value));

export function fromApi(row: ApiEvent): Event {
  return {
    id: row.uuid,
    organizationId: text(row.organization_uuid),
    name: text(row.name),
    tagline: text(row.tagline),
    venueName: text(row.venue_name),
    venueAddress: text(row.venue_address),
    startAt: text(row.start_at),
    endAt: text(row.end_at),
    status: text(row.status),
  };
}

/** Backend statuses are upper case; the mock uses title case. Compare via this. */
export const isPublished = (event: Event) =>
  event.status.toUpperCase() === "PUBLISHED";

export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
