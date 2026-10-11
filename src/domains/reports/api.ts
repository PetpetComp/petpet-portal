import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { ApiResponse } from "@/types/common";
import {
  eventReportFromApi,
  overviewFromApi,
  type ApiEventReport,
  type ApiReportsOverview,
  type EventReport,
  type ReportsOverview,
} from "./types";

/** Laporan satu event: total, ringkasan per kompetisi, dan peserta untuk export. MOCK: belum ada di backend. */
export async function getEventReport(eventId: string): Promise<EventReport> {
  const response = await apiClient.get<ApiResponse<ApiEventReport>>(
    ENDPOINTS.reports.event(eventId),
  );
  return eventReportFromApi(response.data);
}

/** Ringkasan lintas event yang boleh dikelola pemanggil. MOCK: belum ada di backend. */
export async function getReportsOverview(): Promise<ReportsOverview> {
  const response = await apiClient.get<ApiResponse<ApiReportsOverview>>(
    ENDPOINTS.reports.overview,
  );
  return overviewFromApi(response.data);
}
