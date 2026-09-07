import type { ApiResponse } from "@/types/common";
import type { Competition } from "@/types/competition";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockCompetitions } from "@/lib/mocks/competitions";
import { delay, ok } from "@/services/common";

export const competitionService = {
  detail: (id: string): Promise<ApiResponse<Competition>> => {
    // return apiClient.get<ApiResponse<Competition>>(ENDPOINTS.competitions.detail(id));
    const item =
      mockCompetitions.find((c) => c.id === id) ?? mockCompetitions[0];
    return delay(ok(item));
  },
};
