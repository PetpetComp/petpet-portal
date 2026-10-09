import { EVENT_SERVICES } from "@/services/event-management";
import {
  EVENT_SPONSOR_SERVICES,
  STAFF_SERVICES,
} from "@/services/event-operations";
import { ORGANIZATION_SERVICES } from "@/services/organization";
import { collectRows, fetchPageRows } from "@/services/common";
import { fromApi, type ApiEvent, type Event } from "./types";

export async function listEvents(params: {
  page: number;
  perPage: number;
}): Promise<{ items: Event[]; total: number }> {
  const { items, total } = await fetchPageRows<ApiEvent>(
    (p) => EVENT_SERVICES.list(p) as never,
    { page: params.page, per_page: params.perPage },
  );
  return { items: items.map(fromApi), total };
}

export const deleteEvent = (id: string) => EVENT_SERVICES.delete(id);

/** uuid -> name. The events API only returns `organization_uuid`, see docs/09 §C. */
export async function organizationNames(): Promise<Record<string, string>> {
  const rows = await collectRows((p) => ORGANIZATION_SERVICES.list(p) as never);
  return Object.fromEntries(rows.map((o) => [String(o.uuid), String(o.name)]));
}

export async function getEvent(id: string): Promise<Event> {
  const response = await EVENT_SERVICES.detail(id);
  return fromApi(response.data as ApiEvent);
}

/** Only the total is needed, so ask for the smallest page. */
async function countOf(
  fetchPage: Parameters<typeof fetchPageRows>[0],
): Promise<number> {
  return (await fetchPageRows(fetchPage, { page: 1, per_page: 1 })).total;
}

export const countEventStaff = (eventId: string) =>
  countOf((p) => STAFF_SERVICES.forEvent(eventId, p) as never);

export const countEventSponsors = (eventId: string) =>
  countOf((p) => EVENT_SPONSOR_SERVICES.list(eventId, p) as never);
