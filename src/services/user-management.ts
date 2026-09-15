import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  ListParams,
  ListResponse,
  RecordResponse,
  MutationResponse,
  UserPayload,
  UserUpdatePayload,
  UserRecord,
} from "@/types/api";
export const USER_SERVICES = {
  list: (
    params?: ListParams & { q?: string; status?: string; role?: string },
  ) =>
    apiClient.get<ListResponse<UserRecord>>(
      buildUrl(ENDPOINTS.users.list, params),
    ),
  detail: (id: string) =>
    apiClient.get<RecordResponse<UserRecord>>(ENDPOINTS.users.detail(id)),
  create: (payload: UserPayload) =>
    apiClient.post<RecordResponse<UserRecord>>(ENDPOINTS.users.list, {
      ...payload,
    }),
  update: (id: string, payload: UserUpdatePayload) =>
    apiClient.patch<RecordResponse<UserRecord>>(ENDPOINTS.users.detail(id), {
      ...payload,
    }),
  delete: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.users.detail(id)),
  getRole: () => apiClient.get<ListResponse>(ENDPOINTS.auth.roles),
  assignRole: (id: string, role: string) =>
    apiClient.post<RecordResponse<UserRecord>>(ENDPOINTS.users.roles(id), {
      role,
    }),
  revokeRole: (id: string, role: string) =>
    apiClient.delete<RecordResponse<UserRecord>>(
      ENDPOINTS.users.role(id, role),
    ),
};
