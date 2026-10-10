import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { countAt } from "@/lib/api-count";
import { buildUrl, fetchPageRows } from "@/services/common";
import type { ListResponse } from "@/types/api";
import {
  USER_SEARCH_LIMIT,
  userHitFromApi,
  type ApiUserSummary,
  type UserSearchResult,
} from "./types";

export const countUsers = () => countAt(ENDPOINTS.users.list);

/**
 * Cari user lewat `GET /users?q=` (maksimal 5 hasil).
 * `organizationId` meminta server mengurutkan anggota organisasi itu lebih dulu dan
 * menandainya (`is_member`). Dipanggil dari `useUserSearch`.
 */
export async function searchUsers(
  q: string,
  organizationId?: string,
): Promise<UserSearchResult> {
  const { items, total } = await fetchPageRows(
    (page) =>
      apiClient.get<ListResponse<ApiUserSummary>>(
        buildUrl(ENDPOINTS.users.list, {
          q,
          organization_id: organizationId,
          ...page,
        }),
      ),
    { page: 1, per_page: USER_SEARCH_LIMIT },
  );
  return { items: items.map(userHitFromApi), total };
}
