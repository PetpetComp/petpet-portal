import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  ListParams,
  ListResponse,
  RecordResponse,
  MutationResponse,
  EventPayload,
} from "@/types/api";
export const EVENT_SERVICES = {
  list: (params?: ListParams & { organization_id?: string }) =>
    apiClient.get<ListResponse>(buildUrl(ENDPOINTS.events.list, params)),
  detail: (id: string) =>
    apiClient.get<RecordResponse>(ENDPOINTS.events.detail(id)),
  create: (payload: EventPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.events.list, { ...payload }),
  update: (
    id: string,
    payload: Partial<
      Omit<EventPayload, "organization_id" | "new_organization">
    >,
  ) =>
    apiClient.patch<RecordResponse>(ENDPOINTS.events.detail(id), {
      ...payload,
    }),
  delete: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.events.detail(id)),
  publish: (id: string) =>
    apiClient.post<RecordResponse>(ENDPOINTS.events.publish(id)),
};
