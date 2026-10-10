import { apiClient } from "@/lib/api-client";
import { buildUrl, fetchPageRows } from "@/services/common";
import type { ListParams, ListResponse } from "@/types/api";

/**
 * Total of a paged list without loading it: asks for one row and reads `meta.total`.
 * `filters` are extra query params, e.g. `{ status: "SUBMITTED" }`.
 */
export async function countAt(
  url: string,
  filters: Record<string, string> = {},
): Promise<number> {
  const fetchPage = (p: ListParams) =>
    apiClient.get<ListResponse<{ uuid: string }>>(
      buildUrl(url, { ...filters, ...p }),
    );
  return (await fetchPageRows(fetchPage, { page: 1, per_page: 1 })).total;
}
