import { can, type AccessProfile } from "@/lib/auth/access";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  MEMBER_ROLES,
  isMemberRole,
  isOpenApplication,
  type MemberRole,
  type OrganizationMember,
} from "./types";

/**
 * Aturan "siapa boleh apa" untuk organisasi, dalam satu tempat. Logika murni, tanpa React.
 *
 * Sumbernya `ChecksOrgRole::requireOrgRole` di petpet-service (super admin lolos tanpa jadi anggota):
 * - lihat anggota dan verifikasi organisasi: anggota apa pun (OWNER, ADMIN, STAFF)
 * - ubah profil, undang, lihat/cabut undangan, hapus anggota: OWNER atau ADMIN
 * - ubah peran anggota, ajukan verifikasi organisasi: OWNER
 * - ADMIN tidak boleh menghapus OWNER; owner terakhir tidak boleh dihapus atau diturunkan
 *
 * Backend belum mengirim flag `actions` untuk organisasi (docs 09), jadi hak diturunkan dari
 * `/auth/me` (peran global, permission, keanggotaan). Hasilnya hanya menyembunyikan tombol:
 * backend tetap penjaga sebenarnya. Kalau nanti backend mengirim `actions`, hanya file ini yang diganti.
 */

/** Hak seseorang pada satu organisasi. Dihitung sekali oleh `organizationRights`. */
export type OrganizationRights = {
  /** Peran di organisasi ini; null bila bukan anggota. */
  role: MemberRole | null;
  isSuperAdmin: boolean;
  canViewMembers: boolean;
  canViewInvitations: boolean;
  canInvite: boolean;
  canEditProfile: boolean;
  canChangeRoles: boolean;
  canRemoveMembers: boolean;
  canSubmitVerification: boolean;
  canViewVerifications: boolean;
};

/** True bila akun ini super admin. */
export function isSuperAdmin(viewer: AccessProfile): boolean {
  return viewer.roles.includes("SUPER_ADMIN");
}

/**
 * Hak `viewer` pada organisasi `organizationId`. Dipanggil dari `useOrganizationRights`
 * (header, tab, dan tombol di halaman detail organisasi).
 */
export function organizationRights(
  viewer: AccessProfile,
  organizationId: string,
): OrganizationRights {
  const superAdmin = isSuperAdmin(viewer);
  const membership = viewer.memberships.find(
    (m) => m.organizationId === organizationId,
  );
  const role =
    membership && isMemberRole(membership.role) ? membership.role : null;
  const isManager = superAdmin || role === "OWNER" || role === "ADMIN";
  const isOwner = superAdmin || role === "OWNER";
  return {
    role,
    isSuperAdmin: superAdmin,
    canViewMembers: superAdmin || role !== null,
    canViewInvitations: isManager,
    canInvite: isManager,
    canEditProfile: isManager,
    canChangeRoles: isOwner,
    canRemoveMembers: isManager,
    canSubmitVerification: isOwner,
    canViewVerifications: superAdmin || role !== null,
  };
}

/** Jumlah OWNER di daftar anggota. Dipakai aturan "owner terakhir". */
export function ownerCount(members: OrganizationMember[]): number {
  return members.filter((m) => m.role === "OWNER").length;
}

/** True bila `target` satu-satunya OWNER (tidak boleh dihapus atau diturunkan). */
export function isLastOwner(
  target: OrganizationMember,
  members: OrganizationMember[],
): boolean {
  return target.role === "OWNER" && ownerCount(members) <= 1;
}

/**
 * Boleh mengubah peran `target`? Perlu hak ubah peran, dan owner terakhir tidak bisa diturunkan.
 * Dipanggil dari tabel Members untuk memilih dropdown atau teks biasa.
 */
export function canChangeMemberRole(
  rights: OrganizationRights,
  target: OrganizationMember,
  members: OrganizationMember[],
): boolean {
  return rights.canChangeRoles && !isLastOwner(target, members);
}

/**
 * Boleh menghapus `target`? Perlu hak hapus; ADMIN tidak boleh menghapus OWNER;
 * owner terakhir tidak bisa dihapus. Dipanggil dari tabel Members untuk menampilkan tombol Remove.
 */
export function canRemoveMember(
  rights: OrganizationRights,
  target: OrganizationMember,
  members: OrganizationMember[],
): boolean {
  if (!rights.canRemoveMembers) return false;
  if (isLastOwner(target, members)) return false;
  const adminOnly = !rights.isSuperAdmin && rights.role === "ADMIN";
  return !(adminOnly && target.role === "OWNER");
}

/**
 * Boleh meninjau pengajuan organizer dan verifikasi organisasi (approve/reject)?
 * Sama dengan permission `organization.verify` di backend. Dipakai halaman daftar organisasi.
 */
export function canReviewApplications(viewer: AccessProfile): boolean {
  return can(viewer, PERMISSION.ORGANIZATION_VERIFY);
}

/**
 * Boleh mengajukan jadi organizer? Semua user login yang belum punya pengajuan terbuka
 * (backend: 422 "You already have an application in progress."). `mine` = `GET /organizer-applications/me`.
 */
export function canApplyAsOrganizer(mine: { status: string }[]): boolean {
  return !mine.some(isOpenApplication);
}

/** Pengajuan boleh dibatalkan pengaju hanya saat DRAFT atau SUBMITTED (backend `cancel`). */
export function canCancelApplication(application: { status: string }): boolean {
  return application.status === "DRAFT" || application.status === "SUBMITTED";
}

/**
 * Pilihan di dropdown ubah peran: semua peran anggota. Bila peran sekarang tidak dikenal
 * (backend menambah peran baru), kode mentahnya ikut ditampilkan supaya dropdown tidak kosong.
 */
export function roleChoicesFor(current: string): string[] {
  const base: string[] = [...MEMBER_ROLES];
  return base.includes(current) ? base : [current, ...base];
}

/** Undangan sudah lewat masa berlaku? `now` bisa diberikan supaya mudah dites. */
export function isInvitationExpired(
  invitation: { expiresAt: string },
  now: Date = new Date(),
): boolean {
  const expires = new Date(invitation.expiresAt).getTime();
  return !Number.isNaN(expires) && expires < now.getTime();
}
