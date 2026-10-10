import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows } from "@/services/common";
import { listEventEntries } from "@/domains/entries/api";
import { countEventCommittee } from "@/domains/staff/api";
import type { ApiResponse } from "@/types/common";
import type { ListResponse, MutationResponse } from "@/types/api";
import {
  buildCreateEventBody,
  picInvitationEmail,
  type CreateEventOutcome,
  type OrganizerChoice,
  type PicChoice,
} from "./create-flow";
import { detailsToApi, type EventDetails } from "./schema";
import {
  eventListParams,
  eventPageFromApi,
  fromApi,
  type ApiEvent,
  type ApiEventList,
  type Event,
  type EventListQuery,
  type EventPage,
} from "./types";

/** Satu halaman event, difilter/diurutkan/dihitung server (kontrak 13 bagian 1). */
export async function listEvents(query: EventListQuery): Promise<EventPage> {
  const response = await apiClient.get<ApiResponse<ApiEventList>>(
    buildUrl(ENDPOINTS.events.list, eventListParams(query)),
  );
  return eventPageFromApi(response.data);
}

export async function getEvent(id: string): Promise<Event> {
  const response = await apiClient.get<ApiResponse<ApiEvent>>(
    ENDPOINTS.events.detail(id),
  );
  return fromApi(response.data);
}

/** `PATCH /events/{uuid}`: mengirim seluruh isi form Edit. Zona waktu tidak diubah. */
export async function updateEvent(
  id: string,
  details: EventDetails,
): Promise<Event> {
  const response = await apiClient.patch<ApiResponse<ApiEvent>>(
    ENDPOINTS.events.detail(id),
    detailsToApi(details),
  );
  return fromApi(response.data);
}

/** `POST /events/{uuid}/publish`: hanya event Draft yang bisa terbit (aturan backend). */
export async function publishEvent(id: string): Promise<Event> {
  const response = await apiClient.post<ApiResponse<ApiEvent>>(
    ENDPOINTS.events.publish(id),
  );
  return fromApi(response.data);
}

/** `DELETE /events/{uuid}`: di backend artinya membatalkan event (status CANCELLED), bukan menghapus. */
export const cancelEvent = (id: string) =>
  apiClient.delete<MutationResponse>(ENDPOINTS.events.detail(id));

/**
 * Mengundang seseorang sebagai Event manager (PIC) lewat email.
 * Backend hanya menerima email: orang itu menjadi PIC setelah menerima undangan.
 */
export function inviteEventManager(eventId: string, email: string) {
  return apiClient.post<MutationResponse>(ENDPOINTS.staff.invitations, {
    event_id: eventId,
    email,
    assignment_role: "EVENT_MANAGER",
  });
}

/**
 * Langkah terakhir wizard New event: buat event, lalu undang PIC bila dipilih.
 * Dua request terpisah karena backend belum punya satu endpoint untuk keduanya (docs 09).
 * Kalau event berhasil tetapi undangan gagal, event TIDAK dibatalkan: hasilnya membawa
 * `inviteError` supaya layar bisa memberi tahu dan mengarahkan ke event.
 */
export async function createEventWithPic(input: {
  details: EventDetails;
  organizer: OrganizerChoice;
  pic: PicChoice | null;
}): Promise<CreateEventOutcome> {
  const response = await apiClient.post<ApiResponse<ApiEvent>>(
    ENDPOINTS.events.list,
    buildCreateEventBody(input.details, input.organizer),
  );
  const event = fromApi(response.data);
  const email = picInvitationEmail(input.pic);
  if (!email)
    return { eventId: event.id, eventName: event.name, inviteError: null };
  try {
    await inviteEventManager(event.id, email);
    return { eventId: event.id, eventName: event.name, inviteError: null };
  } catch (cause) {
    return {
      eventId: event.id,
      eventName: event.name,
      inviteError:
        cause instanceof Error
          ? cause.message
          : "Unable to send the invitation.",
    };
  }
}

/**
 * Angka checklist "Committee invited": penugasan + undangan PENDING (kontrak 13 bagian 3).
 * Hitungannya ada di domain staff; fungsi ini tinggal nama lama yang dipakai hook Overview.
 */
export const countEventStaff = (eventId: string) =>
  countEventCommittee(eventId);

/** Sponsor satu event: total dan jumlah per level ("GOLD" -> 2), untuk Overview dan tab. */
export type EventSponsorLevels = {
  total: number;
  byLevel: Record<string, number>;
};

export async function getEventSponsorLevels(
  eventId: string,
): Promise<EventSponsorLevels> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<{ uuid: string; sponsorship_level: string }>>(
      buildUrl(ENDPOINTS.events.sponsors(eventId), page),
    ),
  );
  const byLevel: Record<string, number> = {};
  for (const row of rows)
    byLevel[row.sponsorship_level] = (byLevel[row.sponsorship_level] ?? 0) + 1;
  return { total: rows.length, byLevel };
}

/**
 * Jumlah entry (tanpa yang WITHDRAWN) satu event, atau satu kompetisi bila `competitionId` diisi.
 * Memakai `summary.total` dari daftar entry dengan 1 baris per halaman (kontrak 10 bagian 2.1).
 */
export async function countEventEntries(
  eventId: string,
  competitionId?: string,
): Promise<number> {
  const result = await listEventEntries(eventId, {
    competitionId,
    page: 1,
    perPage: 1,
  });
  return result.summary.total;
}
