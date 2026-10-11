import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { countAt } from "@/lib/api-count";
import { buildUrl, collectRows } from "@/services/common";
import type { ListResponse, MutationResponse } from "@/types/api";
import type { ApiResponse } from "@/types/common";
import {
  WAITING_APPLICATION_STATUSES,
  applicationFromApi,
  fromApi,
  invitationFromApi,
  memberFromApi,
  organizationFromApi,
  organizationListParams,
  organizationPageFromApi,
  verificationFromApi,
  type ApiOrganization,
  type ApiOrganizationInvitation,
  type ApiOrganizationInvitationBody,
  type ApiOrganizationList,
  type ApiOrganizationMember,
  type ApiOrganizationUpdateBody,
  type ApiOrganizationVerification,
  type ApiOrganizerApplication,
  type ApiOrganizerApplicationBody,
  type Organization,
  type OrganizationDetail,
  type OrganizationInvitation,
  type OrganizationListQuery,
  type OrganizationMember,
  type OrganizationPage,
  type OrganizationVerification,
  type OrganizerApplication,
} from "./types";

/**
 * Semua panggilan API domain Organizations. Dipanggil hanya dari `queries.ts`.
 * Bentuk response mengikuti backend (petpet-service) dan draf kontrak organizations.
 */

// ---------------------------------------------------------------------------
// Hitungan (Home)
// ---------------------------------------------------------------------------

/** Pengajuan yang masih menunggu keputusan super admin (kartu di Home). */
export async function countPendingApplications(): Promise<number> {
  const totals = await Promise.all(
    WAITING_APPLICATION_STATUSES.map((status) =>
      countAt(ENDPOINTS.organizerApplications.list, { status }),
    ),
  );
  return totals.reduce((a, b) => a + b, 0);
}

export const countOrganizations = () => countAt(ENDPOINTS.organizations.list);

// ---------------------------------------------------------------------------
// Organisasi
// ---------------------------------------------------------------------------

/**
 * Semua organisasi aktif (backend hanya mengembalikan yang sudah terverifikasi).
 * Jumlahnya kecil, jadi dimuat sekaligus lalu dicari di browser.
 * Dipanggil dari `useOrganizations` (list event, wizard New event).
 */
export async function listOrganizations(): Promise<Organization[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganization>>(
      buildUrl(ENDPOINTS.organizations.list, page),
    ),
  );
  return rows.map(fromApi);
}

/** Satu halaman organisasi untuk layar daftar (`GET /organizations`, paging server). */
export async function listOrganizationPage(
  query: OrganizationListQuery,
): Promise<OrganizationPage> {
  const response = await apiClient.get<ApiResponse<ApiOrganizationList>>(
    buildUrl(ENDPOINTS.organizations.list, organizationListParams(query)),
  );
  return organizationPageFromApi(response.data);
}

/** `GET /organizations/{uuid}`: data lengkap satu organisasi (publik). */
export async function getOrganization(id: string): Promise<OrganizationDetail> {
  const response = await apiClient.get<ApiResponse<ApiOrganization>>(
    ENDPOINTS.organizations.detail(id),
  );
  return organizationFromApi(response.data);
}

/** `PATCH /organizations/{uuid}`: simpan profil (OWNER atau ADMIN). */
export async function updateOrganization(
  id: string,
  body: ApiOrganizationUpdateBody,
): Promise<OrganizationDetail> {
  const response = await apiClient.patch<ApiResponse<ApiOrganization>>(
    ENDPOINTS.organizations.detail(id),
    body,
  );
  return organizationFromApi(response.data);
}

// ---------------------------------------------------------------------------
// Anggota
// ---------------------------------------------------------------------------

/**
 * `GET /organizations/{uuid}/members`: seluruh anggota aktif. Backend mengirim array datar;
 * `collectRows` menerima array datar maupun `{ items, meta }`.
 */
export async function getOrganizationMembers(
  id: string,
): Promise<OrganizationMember[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganizationMember>>(
      buildUrl(ENDPOINTS.organizations.members(id), page),
    ),
  );
  return rows.filter((row) => row.status === "ACTIVE").map(memberFromApi);
}

/** `PATCH /organizations/{uuid}/members/{userUuid}`: ubah peran (OWNER). */
export async function changeMemberRole(
  organizationId: string,
  userId: string,
  role: string,
): Promise<OrganizationMember> {
  const response = await apiClient.patch<ApiResponse<ApiOrganizationMember>>(
    ENDPOINTS.organizations.member(organizationId, userId),
    { member_role: role },
  );
  return memberFromApi(response.data);
}

/** `DELETE /organizations/{uuid}/members/{userUuid}`: keluarkan anggota (OWNER atau ADMIN). */
export const removeMember = (organizationId: string, userId: string) =>
  apiClient.delete<MutationResponse>(
    ENDPOINTS.organizations.member(organizationId, userId),
  );

// ---------------------------------------------------------------------------
// Undangan organisasi
// ---------------------------------------------------------------------------

/**
 * `GET /organizations/{uuid}/invitations`: undangan PENDING (array datar). Backend juga
 * mengirim yang sudah lewat masa berlaku; layar menandainya Expired.
 */
export async function getOrganizationInvitations(
  id: string,
): Promise<OrganizationInvitation[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganizationInvitation>>(
      buildUrl(ENDPOINTS.organizations.invitations(id), page),
    ),
  );
  return rows.filter((row) => row.status === "PENDING").map(invitationFromApi);
}

/** `POST /organizations/{uuid}/invitations`. Error 422 membawa pesan per field di `ApiError.errors`. */
export async function inviteOrganizationMember(
  id: string,
  body: ApiOrganizationInvitationBody,
): Promise<OrganizationInvitation> {
  const response = await apiClient.post<ApiResponse<ApiOrganizationInvitation>>(
    ENDPOINTS.organizations.invitations(id),
    body,
  );
  return invitationFromApi(response.data);
}

/** `DELETE /organizations/{uuid}/invitations/{invitationUuid}`: cabut undangan. */
export const revokeOrganizationInvitation = (
  organizationId: string,
  invitationId: string,
) =>
  apiClient.delete<MutationResponse>(
    ENDPOINTS.organizations.invitation(organizationId, invitationId),
  );

// ---------------------------------------------------------------------------
// Pengajuan organizer
// ---------------------------------------------------------------------------

/** `GET /organizer-applications/me`: pengajuan milik sendiri, terbaru dulu (array datar). */
export async function getMyApplications(): Promise<OrganizerApplication[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganizerApplication>>(
      buildUrl(ENDPOINTS.organizerApplications.mine, page),
    ),
  );
  return rows.map(applicationFromApi);
}

/**
 * Antrean super admin: pengajuan SUBMITTED lalu UNDER_REVIEW (`GET /organizer-applications`
 * hanya menerima satu `status` per request, jadi dua request lalu digabung).
 */
export async function getWaitingApplications(): Promise<
  OrganizerApplication[]
> {
  const groups = await Promise.all(
    WAITING_APPLICATION_STATUSES.map((status) =>
      collectRows((page) =>
        apiClient.get<ListResponse<ApiOrganizerApplication>>(
          buildUrl(ENDPOINTS.organizerApplications.list, { status, ...page }),
        ),
      ),
    ),
  );
  return groups.flat().map(applicationFromApi);
}

/** `POST /organizer-applications`: ajukan jadi organizer. Error 422 membawa pesan per field. */
export async function submitApplication(
  body: ApiOrganizerApplicationBody,
): Promise<OrganizerApplication> {
  const response = await apiClient.post<ApiResponse<ApiOrganizerApplication>>(
    ENDPOINTS.organizerApplications.list,
    body,
  );
  return applicationFromApi(response.data);
}

/** `DELETE /organizer-applications/{uuid}`: pengaju membatalkan pengajuannya sendiri. */
export const cancelApplication = (id: string) =>
  apiClient.delete<MutationResponse>(
    ENDPOINTS.organizerApplications.detail(id),
  );

/** `POST /organizer-applications/{uuid}/approve`: membuat organisasi dan menjadikan pengaju OWNER. */
export async function approveApplication(
  id: string,
): Promise<OrganizerApplication> {
  const response = await apiClient.post<ApiResponse<ApiOrganizerApplication>>(
    ENDPOINTS.organizerApplications.approve(id),
  );
  return applicationFromApi(response.data);
}

/** `POST /organizer-applications/{uuid}/reject`: catatan wajib. */
export async function rejectApplication(
  id: string,
  note: string,
): Promise<OrganizerApplication> {
  const response = await apiClient.post<ApiResponse<ApiOrganizerApplication>>(
    ENDPOINTS.organizerApplications.reject(id),
    { review_note: note },
  );
  return applicationFromApi(response.data);
}

// ---------------------------------------------------------------------------
// Verifikasi organisasi
// ---------------------------------------------------------------------------

/** `GET /organizations/{uuid}/verifications`: semua verifikasi satu organisasi (anggota). */
export async function getOrganizationVerifications(
  id: string,
): Promise<OrganizationVerification[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganizationVerification>>(
      buildUrl(ENDPOINTS.organizations.verifications(id), page),
    ),
  );
  return rows.map(verificationFromApi);
}

/** `POST /organizations/{uuid}/verifications`: ajukan satu jenis verifikasi (OWNER). */
export async function submitVerification(
  id: string,
  type: string,
): Promise<OrganizationVerification> {
  const response = await apiClient.post<
    ApiResponse<ApiOrganizationVerification>
  >(ENDPOINTS.organizations.verifications(id), { verification_type: type });
  return verificationFromApi(response.data);
}

/** `GET /verifications?status=PENDING`: antrean verifikasi untuk super admin. */
export async function getPendingVerifications(): Promise<
  OrganizationVerification[]
> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiOrganizationVerification>>(
      buildUrl(ENDPOINTS.verifications.list, { status: "PENDING", ...page }),
    ),
  );
  return rows.map(verificationFromApi);
}

/** `POST /verifications/{uuid}/approve`. */
export async function approveVerification(
  id: string,
): Promise<OrganizationVerification> {
  const response = await apiClient.post<
    ApiResponse<ApiOrganizationVerification>
  >(ENDPOINTS.verifications.approve(id));
  return verificationFromApi(response.data);
}

/** `POST /verifications/{uuid}/reject`: alasan wajib. */
export async function rejectVerification(
  id: string,
  reason: string,
): Promise<OrganizationVerification> {
  const response = await apiClient.post<
    ApiResponse<ApiOrganizationVerification>
  >(ENDPOINTS.verifications.reject(id), { rejection_reason: reason });
  return verificationFromApi(response.data);
}
