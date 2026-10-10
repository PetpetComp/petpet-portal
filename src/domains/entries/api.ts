import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows } from "@/services/common";
import type { ApiResponse } from "@/types/common";
import type { ListResponse, UserRecord } from "@/types/api";
import { petFromApi, type ApiPet, type Pet } from "@/domains/pets/types";
import {
  fromApi,
  periodFromApi,
  type ApiEntry,
  type ApiRegistrationPeriod,
  type Entry,
  type RegistrationPeriod,
} from "./types";

/**
 * Every entry of an event. The API lists entries per competition only, so this
 * asks each competition (a handful per event) and merges the results.
 */
export async function listEventEntries(
  competitionIds: string[],
): Promise<Entry[]> {
  const perCompetition = await Promise.all(
    competitionIds.map((id) =>
      collectRows((p) =>
        apiClient.get<ListResponse<ApiEntry>>(
          buildUrl(ENDPOINTS.competitions.entries(id), p),
        ),
      ),
    ),
  );
  return perCompetition.flat().map(fromApi);
}

export const approveEntry = (id: string) =>
  apiClient.post<ApiResponse<ApiEntry>>(ENDPOINTS.entries.approve(id));

export const rejectEntry = (id: string) =>
  apiClient.post<ApiResponse<ApiEntry>>(ENDPOINTS.entries.reject(id), {});

export async function createEntry(
  competitionId: string,
  body: { pet_id: string; registration_period_id?: string },
): Promise<Entry> {
  const response = await apiClient.post<ApiResponse<ApiEntry>>(
    ENDPOINTS.competitions.entries(competitionId),
    body,
  );
  return fromApi(response.data);
}

export async function listPeriods(
  competitionId: string,
): Promise<RegistrationPeriod[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiRegistrationPeriod>>(
      buildUrl(ENDPOINTS.competitions.periods(competitionId), p),
    ),
  );
  return rows.map(periodFromApi);
}

/** Owner search for on-the-spot registration. Needs `user.view` on the real API (docs/09 §H). */
export async function searchOwners(
  q: string,
): Promise<{ id: string; name: string; email: string }[]> {
  const response = await apiClient.get<ListResponse<UserRecord>>(
    buildUrl(ENDPOINTS.users.list, { q, per_page: 5 }),
  );
  const rows = Array.isArray(response.data)
    ? response.data
    : response.data.items;
  return rows.map((u) => ({
    id: u.uuid,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username,
    email: u.email,
  }));
}

/** Pets of one owner. `owner_id` is a proposed filter (docs/09 §H). */
export async function listOwnerPets(ownerId: string): Promise<Pet[]> {
  const rows = await collectRows((p) =>
    apiClient.get<ListResponse<ApiPet>>(
      buildUrl(ENDPOINTS.pets.list, { ...p, owner_id: ownerId }),
    ),
  );
  return rows.map(petFromApi);
}
