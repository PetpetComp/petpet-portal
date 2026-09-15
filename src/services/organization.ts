import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type { ListParams, ListResponse } from "@/types/api";
export const ORGANIZATION_SERVICES = {
  list: (params?: ListParams) =>
    apiClient.get<ListResponse>(buildUrl(ENDPOINTS.organizations.list, params)),
};
