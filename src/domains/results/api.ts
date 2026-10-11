import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { ApiResponse } from "@/types/common";
import {
  fromApi,
  type ApiCompetitionResults,
  type CompetitionResults,
} from "./types";

/** Klasemen akhir satu kompetisi Race. MOCK: belum ada di backend (draf kontrak results). */
export async function getCompetitionResults(
  competitionId: string,
): Promise<CompetitionResults> {
  const response = await apiClient.get<ApiResponse<ApiCompetitionResults>>(
    ENDPOINTS.results.list(competitionId),
  );
  return fromApi(response.data);
}

/** Memverifikasi hasil (butuh `actions.verify`). Mengembalikan klasemen terbaru. */
export async function verifyCompetitionResults(
  competitionId: string,
): Promise<CompetitionResults> {
  const response = await apiClient.post<ApiResponse<ApiCompetitionResults>>(
    ENDPOINTS.results.verify(competitionId),
    {},
  );
  return fromApi(response.data);
}
