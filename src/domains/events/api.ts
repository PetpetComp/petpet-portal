import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows, fetchPageRows } from "@/services/common";
import type { ApiResponse } from "@/types/common";
import type { ListParams, ListResponse, MutationResponse } from "@/types/api";
import type { ApiOrganization } from "@/domains/organizations/types";
import { fromApi, type ApiEvent, type Event } from "./types";

export async function listEvents(params: {
  page: number;
  perPage: number;
}): Promise<{ items: Event[]; total: number }> {
  const { items, total } = await fetchPageRows(
    (p) =>
      apiClient.get<ListResponse<ApiEvent>>(buildUrl(ENDPOINTS.events.list, p)),
    { page: params.page, per_page: params.perPage },
  );
  return { items: items.map(fromApi), total };
}

export async function getEvent(id: string): Promise<Event> {
  const response = await apiClient.get<ApiResponse<ApiEvent>>(
    ENDPOINTS.events.detail(id),
  );
  return fromApi(response.data);
}

export const deleteEvent = (id: string) =>
  apiClient.delete<MutationResponse>(ENDPOINTS.events.detail(id));

/** uuid -> name. The events API only returns `organization_uuid`, see docs/09 §F. */
export async function organizationNames(): Promise<Record<string, string>> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiOrganization>>(
      buildUrl(ENDPOINTS.organizations.list, p),
    ),
  );
  return Object.fromEntries(rows.map((o) => [o.uuid, o.name]));
}

/** Only the total is needed, so ask for the smallest page. */
async function countOf(url: string): Promise<number> {
  const fetchPage = (p: ListParams) =>
    apiClient.get<ListResponse<{ uuid: string }>>(buildUrl(url, p));
  return (await fetchPageRows(fetchPage, { page: 1, per_page: 1 })).total;
}

export const countEventStaff = (eventId: string) =>
  countOf(ENDPOINTS.events.staff(eventId));

export const countEventSponsors = (eventId: string) =>
  countOf(ENDPOINTS.events.sponsors(eventId));
