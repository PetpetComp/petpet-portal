import type { ApiResponse } from "@/types/common";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockEvents } from "@/lib/mocks/events";
import { mockUsers } from "@/lib/mocks/users";
import { mockPets } from "@/lib/mocks/pets";
import { delay, ok } from "@/services/common";

export interface ReportSummary {
  totalEvents: number;
  totalUsers: number;
  totalPets: number;
}

export const reportService = {
  summary: (): Promise<ApiResponse<ReportSummary>> =>
    // return apiClient.get<ApiResponse<ReportSummary>>(ENDPOINTS.reports.summary);
    delay(
      ok({
        totalEvents: mockEvents.length,
        totalUsers: mockUsers.length,
        totalPets: mockPets.length,
      }),
    ),
};
