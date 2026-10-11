import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  approveApplication,
  approveVerification,
  cancelApplication,
  changeMemberRole,
  countOrganizations,
  countPendingApplications,
  createOrganization,
  getMyApplications,
  getOrganization,
  getOrganizationInvitations,
  getOrganizationMembers,
  getOrganizationVerifications,
  getPendingVerifications,
  getWaitingApplications,
  inviteOrganizationMember,
  listOrganizationDirectory,
  listOrganizationPage,
  listOrganizations,
  rejectApplication,
  rejectVerification,
  removeMember,
  revokeOrganizationInvitation,
  submitApplication,
  submitVerification,
  updateOrganization,
} from "./api";
import type {
  ApiOrganizationCreateBody,
  ApiOrganizationInvitationBody,
  ApiOrganizationUpdateBody,
  ApiOrganizerApplicationBody,
  OrganizationListQuery,
} from "./types";

export const organizationKeys = {
  all: ["organizations"] as const,
  list: ["organizations", "list"] as const,
  directory: ["organizations", "list", "directory"] as const,
  page: (query: OrganizationListQuery) =>
    ["organizations", "list", "page", query] as const,
  detail: (id: string) => ["organizations", "detail", id] as const,
  members: (id: string) => ["organizations", "members", id] as const,
  invitations: (id: string) => ["organizations", "invitations", id] as const,
  verifications: (id: string) =>
    ["organizations", "verifications", id] as const,
  pendingApplications: ["organizer-applications", "pending-count"] as const,
  waitingApplications: ["organizer-applications", "waiting"] as const,
  myApplications: ["organizer-applications", "mine"] as const,
  verificationQueue: ["verifications", "pending"] as const,
  count: ["organizations", "count"] as const,
};

// ---------------------------------------------------------------------------
// Bacaan
// ---------------------------------------------------------------------------

export function usePendingApplicationsCount(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.pendingApplications,
    queryFn: countPendingApplications,
    enabled,
  });
}

export function useOrganizationsCount(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.count,
    queryFn: countOrganizations,
    enabled,
  });
}

/** Daftar organisasi aktif, di-cache 5 menit karena jarang berubah. */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list,
    queryFn: listOrganizations,
    staleTime: 5 * 60_000,
  });
}

/** Satu halaman daftar organisasi dari server. Halaman lama tetap tampil selama halaman baru dimuat. */
export function useOrganizationPage(query: OrganizationListQuery) {
  return useQuery({
    queryKey: organizationKeys.page(query),
    queryFn: () => listOrganizationPage(query),
    placeholderData: keepPreviousData,
  });
}

/** Semua organisasi dengan kontak, untuk filter dan pencarian di browser. `enabled` false = tidak dimuat. */
export function useOrganizationDirectory(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.directory,
    queryFn: listOrganizationDirectory,
    enabled,
  });
}

/** Data lengkap satu organisasi (header dan tab Profile). */
export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => getOrganization(id),
  });
}

/**
 * Seluruh anggota satu organisasi. `enabled` false untuk yang bukan anggota
 * (backend menjawab 403, jadi request tidak perlu dikirim).
 */
export function useOrganizationMembers(id: string, enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.members(id),
    queryFn: () => getOrganizationMembers(id),
    enabled,
  });
}

/** Undangan Pending satu organisasi (hanya OWNER/ADMIN yang boleh melihat). */
export function useOrganizationInvitations(id: string, enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.invitations(id),
    queryFn: () => getOrganizationInvitations(id),
    enabled,
  });
}

/** Verifikasi satu organisasi (anggota boleh melihat). */
export function useOrganizationVerifications(id: string, enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.verifications(id),
    queryFn: () => getOrganizationVerifications(id),
    enabled,
  });
}

/** Pengajuan organizer milik user yang login. */
export function useMyApplications() {
  return useQuery({
    queryKey: organizationKeys.myApplications,
    queryFn: getMyApplications,
  });
}

/** Antrean pengajuan yang menunggu keputusan (hanya untuk pemegang `organization.verify`). */
export function useWaitingApplications(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.waitingApplications,
    queryFn: getWaitingApplications,
    enabled,
  });
}

/** Antrean verifikasi organisasi yang PENDING (hanya untuk pemegang `organization.verify`). */
export function usePendingVerifications(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.verificationQueue,
    queryFn: getPendingVerifications,
    enabled,
  });
}

// ---------------------------------------------------------------------------
// Perubahan
// ---------------------------------------------------------------------------

/** Muat ulang semua data organisasi: daftar, detail, anggota, undangan. Dipakai setelah perubahan besar. */
function useRefreshOrganizations() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: organizationKeys.all });
}

/** Simpan profil organisasi. */
export function useUpdateOrganization(id: string) {
  const refresh = useRefreshOrganizations();
  return useMutation({
    mutationFn: (body: ApiOrganizationUpdateBody) =>
      updateOrganization(id, body),
    onSuccess: refresh,
  });
}

/** Admin membuat organisasi langsung (USULAN). Daftar dimuat ulang; hasilnya dibaca pemanggil. */
export function useCreateOrganization() {
  const refresh = useRefreshOrganizations();
  return useMutation({
    mutationFn: (body: ApiOrganizationCreateBody) => createOrganization(body),
    onSuccess: refresh,
  });
}

/** Ubah peran satu anggota. Dipanggil dengan `{ userId, role }`. */
export function useChangeMemberRole(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: string }) =>
      changeMemberRole(organizationId, input.userId, input.role),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      }),
  });
}

/** Keluarkan satu anggota (argumen: uuid user). */
export function useRemoveMember(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await removeMember(organizationId, userId);
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      }),
  });
}

/** Kirim undangan baru. Error 422 dibaca pemanggil lewat `ApiError.errors`. */
export function useInviteMember(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiOrganizationInvitationBody) =>
      inviteOrganizationMember(organizationId, body),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: organizationKeys.invitations(organizationId),
      }),
  });
}

/** Cabut undangan Pending (argumen: uuid undangan). */
export function useRevokeOrganizationInvitation(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await revokeOrganizationInvitation(organizationId, invitationId);
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: organizationKeys.invitations(organizationId),
      }),
  });
}

/** Muat ulang semua yang bergantung pada pengajuan: milik sendiri, antrean, hitungan Home. */
function useRefreshApplications() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: organizationKeys.myApplications }),
      client.invalidateQueries({
        queryKey: organizationKeys.waitingApplications,
      }),
      client.invalidateQueries({
        queryKey: organizationKeys.pendingApplications,
      }),
    ]);
}

/** Ajukan jadi organizer. Error 422 dibaca pemanggil lewat `ApiError.errors`. */
export function useSubmitApplication() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: (body: ApiOrganizerApplicationBody) => submitApplication(body),
    onSuccess: refresh,
  });
}

/** Pengaju membatalkan pengajuannya (argumen: uuid pengajuan). */
export function useCancelApplication() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: async (id: string) => {
      await cancelApplication(id);
    },
    onSuccess: refresh,
  });
}

/** Super admin menyetujui pengajuan: organisasi baru ikut muncul di daftar. */
export function useApproveApplication() {
  const refreshApplications = useRefreshApplications();
  const refreshOrganizations = useRefreshOrganizations();
  return useMutation({
    mutationFn: (id: string) => approveApplication(id),
    onSuccess: () =>
      Promise.all([refreshApplications(), refreshOrganizations()]),
  });
}

/** Super admin menolak pengajuan dengan catatan. */
export function useRejectApplication() {
  const refresh = useRefreshApplications();
  return useMutation({
    mutationFn: (input: { id: string; note: string }) =>
      rejectApplication(input.id, input.note),
    onSuccess: refresh,
  });
}

/** Muat ulang antrean verifikasi dan daftar verifikasi per organisasi. */
function useRefreshVerifications() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({
        queryKey: organizationKeys.verificationQueue,
      }),
      client.invalidateQueries({
        queryKey: ["organizations", "verifications"],
      }),
    ]);
}

/** OWNER mengajukan satu jenis verifikasi (argumen: kode jenis). */
export function useSubmitVerification(organizationId: string) {
  const refresh = useRefreshVerifications();
  return useMutation({
    mutationFn: (type: string) => submitVerification(organizationId, type),
    onSuccess: refresh,
  });
}

/** Super admin menyetujui verifikasi (argumen: uuid verifikasi). */
export function useApproveVerification() {
  const refresh = useRefreshVerifications();
  return useMutation({
    mutationFn: (id: string) => approveVerification(id),
    onSuccess: refresh,
  });
}

/** Super admin menolak verifikasi dengan alasan. */
export function useRejectVerification() {
  const refresh = useRefreshVerifications();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      rejectVerification(input.id, input.reason),
    onSuccess: refresh,
  });
}
