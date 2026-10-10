import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows, fetchPageRows } from "@/services/common";
import type { ApiResponse } from "@/types/common";
import type { ListResponse, MutationResponse } from "@/types/api";
import { countAt } from "@/lib/api-count";
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

export const countEventStaff = (eventId: string) =>
  countAt(ENDPOINTS.events.staff(eventId));

export const countEventSponsors = (eventId: string) =>
  countAt(ENDPOINTS.events.sponsors(eventId));
