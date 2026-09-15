import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  EntryPayload,
  StaffInvitationPayload,
  SponsorAssignmentPayload,
  ListParams,
  ListResponse,
  RecordResponse,
  MutationResponse,
} from "@/types/api";
export const ENTRY_SERVICES = {
  list: (competitionId: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.competitions.entries(competitionId), params),
    ),
  detail: (id: string) =>
    apiClient.get<RecordResponse>(ENDPOINTS.entries.detail(id)),
  create: (competitionId: string, payload: EntryPayload) =>
    apiClient.post<RecordResponse>(
      ENDPOINTS.competitions.entries(competitionId),
      { ...payload },
    ),
  delete: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.entries.detail(id)),
  approve: (id: string) =>
    apiClient.post<RecordResponse>(ENDPOINTS.entries.approve(id)),
  reject: (id: string, reason?: string) =>
    apiClient.post<RecordResponse>(
      ENDPOINTS.entries.reject(id),
      reason ? { reason } : undefined,
    ),
  checkin: (id: string) =>
    apiClient.post<RecordResponse>(ENDPOINTS.entries.checkin(id)),
};
export const EVENT_SPONSOR_SERVICES = {
  list: (eventId: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.events.sponsors(eventId), params),
    ),
  create: (eventId: string, payload: SponsorAssignmentPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.events.sponsors(eventId), {
      ...payload,
    }),
  delete: (eventId: string, id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.events.sponsor(eventId, id)),
};
export const STAFF_SERVICES = {
  invitations: (
    params?: ListParams & { event_id?: string; competition_id?: string },
  ) =>
    apiClient.get<ListResponse>(buildUrl(ENDPOINTS.staff.invitations, params)),
  forEvent: (eventId: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.events.staff(eventId), params),
    ),
  forCompetition: (competitionId: string, params?: ListParams) =>
    apiClient.get<ListResponse>(
      buildUrl(ENDPOINTS.competitions.staff(competitionId), params),
    ),
  invite: (payload: StaffInvitationPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.staff.invitations, { ...payload }),
  deleteInvitation: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.staff.invitation(id)),
  deleteAssignment: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.staff.assignment(id)),
};
