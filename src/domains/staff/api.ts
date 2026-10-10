import { apiClient } from "@/lib/api-client";
import { countAt } from "@/lib/api-count";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows } from "@/services/common";
import type { ListResponse, MutationResponse } from "@/types/api";
import type { ApiResponse } from "@/types/common";
import {
  FALLBACK_ASSIGNMENT_ROLES,
  invitationFromApi,
  memberFromApi,
  roleFromApi,
  type ApiAssignmentRole,
  type ApiStaffAssignment,
  type ApiStaffInvitation,
  type ApiStaffInvitationBody,
  type AssignmentRole,
  type PendingInvitation,
  type StaffMember,
} from "./types";

/**
 * Daftar peran dari `GET /master/assignment-roles`. Endpoint ini belum ada di backend asli
 * (doc 09 bagian N), jadi bila request gagal untuk alasan apa pun dipakai
 * `FALLBACK_ASSIGNMENT_ROLES` (isinya sama dengan kontrak) supaya form undang tetap bisa dipakai.
 * Dipanggil dari `useAssignmentRoles`.
 */
export async function getAssignmentRoles(): Promise<AssignmentRole[]> {
  try {
    const response = await apiClient.get<ApiResponse<ApiAssignmentRole[]>>(
      ENDPOINTS.master.assignmentRoles,
    );
    if (Array.isArray(response.data) && response.data.length > 0)
      return response.data.map(roleFromApi);
  } catch {
    // Sengaja ditelan: lihat komentar fungsi. Peran cadangan lebih berguna daripada layar error.
  }
  return FALLBACK_ASSIGNMENT_ROLES.map(roleFromApi);
}

/**
 * Semua penugasan AKTIF satu event: tim event dan penugasan semua kompetisinya
 * (`GET /events/{uuid}/staff`). Backend asli mengirim array datar, kontrak mengirim
 * `{ items, meta }`; `collectRows` menerima keduanya.
 */
export async function getEventStaff(eventId: string): Promise<StaffMember[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiStaffAssignment>>(
      buildUrl(ENDPOINTS.events.staff(eventId), page),
    ),
  );
  return rows.filter((row) => row.status === "ACTIVE").map(memberFromApi);
}

/**
 * Undangan PENDING satu event (`GET /staff-invitations?event_id=`, array datar).
 * Di backend asli endpoint ini butuh `staff.manage`, jadi akun lain mendapat 403;
 * pemanggil (hook) membiarkan error itu sampai ke layar sebagai peringatan kecil.
 */
export async function getEventInvitations(
  eventId: string,
): Promise<PendingInvitation[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiStaffInvitation>>(
      buildUrl(ENDPOINTS.staff.invitations, { event_id: eventId, ...page }),
    ),
  );
  return rows.filter((row) => row.status === "PENDING").map(invitationFromApi);
}

/** `POST /staff-invitations`. Error 422 membawa pesan per field di `ApiError.errors`. */
export async function inviteStaff(
  body: ApiStaffInvitationBody,
): Promise<PendingInvitation> {
  const response = await apiClient.post<ApiResponse<ApiStaffInvitation>>(
    ENDPOINTS.staff.invitations,
    body,
  );
  return invitationFromApi(response.data);
}

/** `DELETE /staff-assignments/{uuid}`: mencabut penugasan (tombol Remove). */
export const revokeAssignment = (id: string) =>
  apiClient.delete<MutationResponse>(ENDPOINTS.staff.assignment(id));

/** `DELETE /staff-invitations/{uuid}`: mencabut undangan yang masih Pending (tombol Revoke). */
export const revokeInvitation = (id: string) =>
  apiClient.delete<MutationResponse>(ENDPOINTS.staff.invitation(id));

/**
 * Angka untuk checklist "Committee invited" di Overview: jumlah penugasan ditambah undangan
 * PENDING (kontrak 13 bagian 3). Undangan hanya dihitung bila penugasan 0 (angkanya hanya
 * dipakai sebagai "ada atau tidak"), dan 403/gagal dianggap 0 supaya checklist tidak error.
 */
export async function countEventCommittee(eventId: string): Promise<number> {
  const assignments = await countAt(ENDPOINTS.events.staff(eventId));
  if (assignments > 0) return assignments;
  try {
    return (await getEventInvitations(eventId)).length;
  } catch {
    return 0;
  }
}
