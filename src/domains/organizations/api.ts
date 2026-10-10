import { ENDPOINTS } from "@/lib/constants/endpoints";
import { countAt } from "@/lib/api-count";
import type { OrganizerApplicationStatus } from "./types";

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
