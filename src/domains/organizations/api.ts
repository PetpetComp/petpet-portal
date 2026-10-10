import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { countAt } from "@/lib/api-count";
import { buildUrl, collectRows } from "@/services/common";
import type { ListResponse } from "@/types/api";
import {
  fromApi,
  type ApiOrganization,
  type Organization,
  type OrganizerApplicationStatus,
} from "./types";

/** Applications a super admin still has to decide on. */
export async function countPendingApplications(): Promise<number> {
  const waiting: OrganizerApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW"];
  const totals = await Promise.all(
    waiting.map((status) =>
      countAt(ENDPOINTS.organizerApplications.list, { status }),
    ),
  );
  return totals.reduce((a, b) => a + b, 0);
}

export const countOrganizations = () => countAt(ENDPOINTS.organizations.list);

/**
 * Semua organisasi aktif (backend hanya mengembalikan yang sudah terverifikasi).
 * Jumlahnya kecil, jadi dimuat sekaligus lalu dicari di browser.
 * Dipanggil dari `useOrganizations` (list event, wizard New event).
 */
export async function listOrganizations(): Promise<Organization[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganization>>(
      buildUrl(ENDPOINTS.organizations.list, page),
    ),
  );
  return rows.map(fromApi);
}
