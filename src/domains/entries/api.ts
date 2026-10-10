import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "@/services/common";
import type { ApiResponse } from "@/types/common";
import {
  entryListParams,
  eventEntriesFromApi,
  fromApi,
  ownerFromApi,
  type ApiEntry,
  type ApiEventEntries,
  type ApiOwnerSearchResult,
  type Entry,
  type EntryListQuery,
  type EventEntries,
  type Owner,
} from "./types";

/** One page of an event's entries, filtered, sorted and counted by the API (contract 10 §2.1). */
export async function listEventEntries(
  eventId: string,
  query: EntryListQuery,
): Promise<EventEntries> {
  const response = await apiClient.get<ApiResponse<ApiEventEntries>>(
    buildUrl(ENDPOINTS.events.entries(eventId), entryListParams(query)),
  );
  return eventEntriesFromApi(response.data);
}

async function entryAction(url: string, body?: Record<string, unknown>) {
  const response = await apiClient.post<ApiResponse<ApiEntry>>(url, body);
  return fromApi(response.data);
}

export const approveEntry = (id: string) =>
  entryAction(ENDPOINTS.entries.approve(id));

export const rejectEntry = (id: string) =>
  entryAction(ENDPOINTS.entries.reject(id), {});

/** Simulasi pembayaran: menandai entry lunas. Belum ada di backend asli (kontrak 13 bagian 2). */
export const markEntryPaid = (id: string) =>
  entryAction(ENDPOINTS.entries.markPaid(id));

export const checkInEntry = (id: string) =>
  entryAction(ENDPOINTS.entries.checkin(id));

export const undoCheckIn = (id: string) =>
  entryAction(ENDPOINTS.entries.undoCheckin(id));

/** The backend picks the registration period and the fee (contract 10 §2.4). */
export async function createEntry(
  competitionId: string,
  body: { pet_id: string },
): Promise<Entry> {
  const response = await apiClient.post<ApiResponse<ApiEntry>>(
    ENDPOINTS.competitions.entries(competitionId),
    body,
  );
  return fromApi(response.data);
}

/** Owners (with their pets) for on-the-spot registration (contract 10 §2.5). */
export async function searchOwners(
  eventId: string,
  q: string,
): Promise<Owner[]> {
  const response = await apiClient.get<
    ApiResponse<{ items: ApiOwnerSearchResult[] }>
  >(buildUrl(ENDPOINTS.events.ownerSearch(eventId), { q }));
  return response.data.items.map(ownerFromApi);
}
