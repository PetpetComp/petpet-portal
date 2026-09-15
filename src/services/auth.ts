import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { LoginResponse, MeResponse, SignUpPayload } from "@/types/auth";
import type { MutationResponse, ListResponse } from "@/types/api";
export const AUTH_SERVICES = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>(ENDPOINTS.auth.login, { email, password }),
  register: (payload: SignUpPayload) =>
    apiClient.post<LoginResponse>(ENDPOINTS.auth.register, { ...payload }),
  me: () => apiClient.get<MeResponse>(ENDPOINTS.auth.me),
  logout: () => apiClient.post<MutationResponse>(ENDPOINTS.auth.logout),
  roles: () => apiClient.get<ListResponse>(ENDPOINTS.auth.roles),
  permissions: () => apiClient.get<ListResponse>(ENDPOINTS.auth.permissions),
};
