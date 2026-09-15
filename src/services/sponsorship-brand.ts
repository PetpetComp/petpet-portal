import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  ListParams,
  ListResponse,
  RecordResponse,
  SponsorPayload,
} from "@/types/api";
export const SPONSOR_SERVICES = {
  list: (params?: ListParams) =>
    apiClient.get<ListResponse>(buildUrl(ENDPOINTS.sponsors.list, params)),
  detail: (id: string) =>
    apiClient.get<RecordResponse>(ENDPOINTS.sponsors.detail(id)),
  create: (payload: SponsorPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.sponsors.list, { ...payload }),
  update: (id: string, payload: Partial<SponsorPayload>) =>
    apiClient.patch<RecordResponse>(ENDPOINTS.sponsors.detail(id), {
      ...payload,
    }),
  addPic: (id: string, userId: string) =>
    apiClient.post<RecordResponse>(ENDPOINTS.sponsors.pics(id), {
      user_id: userId,
    }),
  removePic: (id: string, userId: string) =>
    apiClient.delete<RecordResponse>(ENDPOINTS.sponsors.pic(id, userId)),
};
