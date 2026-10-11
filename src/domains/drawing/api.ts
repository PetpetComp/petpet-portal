import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import type { ApiResponse } from "@/types/common";
import {
  fromApi,
  type ApiDrawing,
  type ApiLockDrawingBody,
  type ApiSwapDrawingBody,
  type CompetitionDrawing,
} from "./types";

/** Keadaan drawing satu kompetisi Race atau Time trial. MOCK: belum ada di backend (draf kontrak drawing). */
export async function getDrawing(
  competitionId: string,
): Promise<CompetitionDrawing> {
  const response = await apiClient.get<ApiResponse<ApiDrawing>>(
    ENDPOINTS.drawing.detail(competitionId),
  );
  return fromApi(response.data);
}

/** Susunan entry id per match menjadi body Lock (nomor lane = urutan + 1). */
export function lockBody(
  matches: readonly (readonly string[])[],
): ApiLockDrawingBody {
  return {
    matches: matches.map((ids) => ({
      lanes: ids.map((entryId, index) => ({
        lane_number: index + 1,
        entry_uuid: entryId,
      })),
    })),
  };
}

/** Menyimpan seluruh drawing sekaligus (butuh `actions.lock`). Mengembalikan drawing yang terkunci. */
export async function lockDrawing(
  competitionId: string,
  matches: readonly (readonly string[])[],
): Promise<CompetitionDrawing> {
  const response = await apiClient.post<ApiResponse<ApiDrawing>>(
    ENDPOINTS.drawing.detail(competitionId),
    lockBody(matches),
  );
  return fromApi(response.data);
}

/** Menukar dua peserta setelah Lock (butuh `actions.swap`). Mengembalikan drawing terbaru. */
export async function swapDrawing(
  competitionId: string,
  entryIdA: string,
  entryIdB: string,
): Promise<CompetitionDrawing> {
  const body: ApiSwapDrawingBody = {
    entry_uuid_a: entryIdA,
    entry_uuid_b: entryIdB,
  };
  const response = await apiClient.post<ApiResponse<ApiDrawing>>(
    ENDPOINTS.drawing.swap(competitionId),
    body,
  );
  return fromApi(response.data);
}
