import type { ApiPageMeta } from "@/types/api";

/**
 * Tipe domain Organizations. Bentuk `Api*` mengikuti response backend (petpet-service
 * `Organization*Data::toArray`) dan kontrak petpet-docs/13 (draf organizations). Tipe layar
 * (camelCase) dibuat hanya oleh mapper `*FromApi` di bawah.
 */

// ---------------------------------------------------------------------------
// Organisasi
// ---------------------------------------------------------------------------

/** One organization exactly as the API sends it (petpet-service `OrganizationData::toArray`). */
export type ApiOrganization = {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  sponsor_uuid: string | null;
};

/** Backend `OrganizationConstant::STATUS_ACTIVE`: satu-satunya status yang ada. */
export const ORGANIZATION_STATUS_ACTIVE = "ACTIVE";

/** Organisasi seperti dipakai layar (pemilih organizer, filter list event). Dibuat oleh `fromApi`. */
export type Organization = {
  id: string;
  name: string;
};

/** Mengubah satu baris API menjadi bentuk layar. Dipanggil dari `listOrganizations`. */
export function fromApi(row: ApiOrganization): Organization {
  return { id: row.uuid, name: row.name };
}

/** Organisasi lengkap untuk halaman detail dan tab Profile. Dibuat oleh `organizationFromApi`. */
export type OrganizationDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  /** True bila organisasi sudah disetujui (status ACTIVE): badge "Verified" di layar. */
  isVerified: boolean;
};

/** Baris API -> organisasi lengkap. Field kosong (null) menjadi string kosong supaya form mudah. */
export function organizationFromApi(row: ApiOrganization): OrganizationDetail {
  return {
    id: row.uuid,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    status: row.status,
    isVerified: row.status === ORGANIZATION_STATUS_ACTIVE,
  };
}

/** Satu halaman `GET /organizations` seperti dikirim backend. */
export type ApiOrganizationList = {
  items: ApiOrganization[];
  meta: ApiPageMeta;
};

/**
 * Baris di layar daftar organisasi: nama plus kontak singkat untuk kartu yang lebih padat.
 * Field kontak opsional supaya data sederhana `{ id, name }` tetap sah.
 */
export type OrganizationListItem = Organization & {
  email?: string;
  phone?: string;
  address?: string;
};

/** Baris API -> baris daftar (kontak kosong menjadi string kosong). */
export function listItemFromApi(row: ApiOrganization): OrganizationListItem {
  return {
    id: row.uuid,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
  };
}

/** Satu halaman organisasi untuk layar list. */
export type OrganizationPage = {
  items: OrganizationListItem[];
  meta: { page: number; perPage: number; total: number; lastPage: number };
};

/** Query list organisasi. `q` hanya didukung mock (kontrak: "Hanya di mock"). */
export type OrganizationListQuery = {
  q?: string;
  page: number;
  perPage: number;
};

/** Query `GET /organizations` dari status layar. Teks kosong tidak ikut terkirim. */
export function organizationListParams(query: OrganizationListQuery) {
  return {
    q: query.q?.trim() || undefined,
    page: query.page,
    per_page: query.perPage,
  };
}

/** Halaman API -> halaman layar. */
export function organizationPageFromApi(
  data: ApiOrganizationList,
): OrganizationPage {
  return {
    items: data.items.map(listItemFromApi),
    meta: {
      page: data.meta.current_page,
      perPage: data.meta.per_page,
      total: data.meta.total,
      lastPage: data.meta.last_page,
    },
  };
}

/** Body `PATCH /organizations/{uuid}`. Field opsional dikirim `null` bila dikosongkan. */
export type ApiOrganizationUpdateBody = {
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

/**
 * Body `POST /organizations` (USULAN, belum ada di backend: petpet-docs/09 bagian T). Bentuknya
 * sama dengan body `PATCH`; hanya pemegang `organization.verify` yang boleh memanggil.
 */
export type ApiOrganizationCreateBody = ApiOrganizationUpdateBody;

// ---------------------------------------------------------------------------
// Anggota
// ---------------------------------------------------------------------------

/** Backend `OrganizationMemberConstant::ROLES`. */
export const MEMBER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Peran yang boleh diberikan lewat undangan (backend `OrganizationInvitationConstant::MEMBER_ROLES`). */
export const INVITABLE_ROLES = ["ADMIN", "STAFF"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Label peran di dropdown dan chip. */
export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  STAFF: "Staff",
};

/** Label peran; kode yang tidak dikenal ditampilkan apa adanya. */
export function memberRoleLabel(code: string): string {
  return MEMBER_ROLE_LABEL[code as MemberRole] ?? code;
}

/** True bila `value` salah satu peran anggota yang dikenal. */
export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

/**
 * Satu anggota dari `GET /organizations/{uuid}/members` (`OrganizationMemberData::toArray`).
 * `user_email` BELUM dikirim backend asli (draf kontrak), jadi opsional.
 */
export type ApiOrganizationMember = {
  uuid: string;
  user_uuid: string;
  user_name: string;
  user_email?: string | null;
  member_role: string;
  status: string;
};

/** Satu anggota di tabel Members. Dibuat oleh `memberFromApi`. */
export type OrganizationMember = {
  id: string;
  userId: string;
  name: string;
  /** Null bila backend belum mengirim email. */
  email: string | null;
  /** Kode peran mentah; gunakan `memberRoleLabel` untuk tampilan. */
  role: string;
};

/** Baris API -> anggota layar. Aman bila `user_email` belum dikirim backend. */
export function memberFromApi(row: ApiOrganizationMember): OrganizationMember {
  return {
    id: row.uuid,
    userId: row.user_uuid,
    name: row.user_name,
    email: row.user_email ?? null,
    role: row.member_role,
  };
}

// ---------------------------------------------------------------------------
// Undangan organisasi
// ---------------------------------------------------------------------------

/** Backend `OrganizationInvitationConstant::STATUS_*`. Layar hanya menampilkan PENDING. */
export const ORG_INVITATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "REVOKED",
] as const;
export type OrgInvitationStatus = (typeof ORG_INVITATION_STATUSES)[number];

/**
 * Satu undangan (`OrganizationInvitationData::toArray`). `token` mentah hanya ada di response
 * `POST`; layar sengaja tidak memakainya.
 */
export type ApiOrganizationInvitation = {
  uuid: string;
  organization_name: string;
  email: string;
  member_role: string;
  status: string;
  expires_at: string;
  token?: string;
};

/** Body `POST /organizations/{uuid}/invitations`. */
export type ApiOrganizationInvitationBody = {
  email: string;
  member_role: string;
};

/** Satu undangan di tab Pending invitations. */
export type OrganizationInvitation = {
  id: string;
  email: string;
  role: string;
  /** ISO-8601; dipakai chip Expired dan teks "Expires ...". */
  expiresAt: string;
};

/** Baris API -> undangan layar. */
export function invitationFromApi(
  row: ApiOrganizationInvitation,
): OrganizationInvitation {
  return {
    id: row.uuid,
    email: row.email,
    role: row.member_role,
    expiresAt: row.expires_at,
  };
}

// ---------------------------------------------------------------------------
// Pengajuan organizer
// ---------------------------------------------------------------------------

/** Backend values of `organizer_applications.status`. */
export const ORGANIZER_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type OrganizerApplicationStatus =
  (typeof ORGANIZER_APPLICATION_STATUSES)[number];

/** Status yang masih menunggu keputusan super admin (antrean). */
export const WAITING_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
] as const satisfies readonly OrganizerApplicationStatus[];

/** Status yang masih terbuka: pengaju tidak boleh mengajukan lagi (backend `hasOpenApplication`). */
export const OPEN_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
] as const satisfies readonly OrganizerApplicationStatus[];

/** Label status pengajuan di badge. */
export const APPLICATION_STATUS_LABEL: Record<
  OrganizerApplicationStatus,
  string
> = {
  DRAFT: "Draft",
  SUBMITTED: "Waiting for review",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

/**
 * Satu pengajuan (`OrganizerApplicationData::toArray`). `applicant_name` dan `applicant_email`
 * BELUM dikirim backend asli (draf kontrak), jadi opsional.
 */
export type ApiOrganizerApplication = {
  uuid: string;
  proposed_organization_name: string;
  organization_type: string | null;
  description: string | null;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  status: string;
  review_note: string | null;
  approved_organization_uuid: string | null;
  applicant_name?: string | null;
  applicant_email?: string | null;
};

/** Body `POST /organizer-applications`. */
export type ApiOrganizerApplicationBody = {
  proposed_organization_name: string;
  contact_email: string;
  organization_type?: string;
  description?: string;
  contact_phone?: string;
  address?: string;
};

/** Satu pengajuan untuk layar. */
export type OrganizerApplication = {
  id: string;
  organizationName: string;
  organizationType: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  /** Kode status mentah; label lewat `applicationStatusLabel`. */
  status: string;
  reviewNote: string;
  approvedOrganizationId: string | null;
  /** Null bila backend belum mengirim nama pengaju. */
  applicantName: string | null;
  applicantEmail: string | null;
};

/** Baris API -> pengajuan layar. */
export function applicationFromApi(
  row: ApiOrganizerApplication,
): OrganizerApplication {
  return {
    id: row.uuid,
    organizationName: row.proposed_organization_name,
    organizationType: row.organization_type ?? "",
    description: row.description ?? "",
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone ?? "",
    address: row.address ?? "",
    status: row.status,
    reviewNote: row.review_note ?? "",
    approvedOrganizationId: row.approved_organization_uuid,
    applicantName: row.applicant_name ?? null,
    applicantEmail: row.applicant_email ?? null,
  };
}

/** Label status pengajuan; kode yang tidak dikenal ditampilkan apa adanya. */
export function applicationStatusLabel(status: string): string {
  return (
    APPLICATION_STATUS_LABEL[status as OrganizerApplicationStatus] ?? status
  );
}

/** True bila pengajuan masih menunggu keputusan. */
export function isWaitingApplication(application: { status: string }): boolean {
  return (WAITING_APPLICATION_STATUSES as readonly string[]).includes(
    application.status,
  );
}

/** True bila pengajuan masih terbuka (pengaju belum boleh mengajukan lagi). */
export function isOpenApplication(application: { status: string }): boolean {
  return (OPEN_APPLICATION_STATUSES as readonly string[]).includes(
    application.status,
  );
}

// ---------------------------------------------------------------------------
// Verifikasi organisasi
// ---------------------------------------------------------------------------

/** Backend `OrganizationVerificationConstant::TYPES`. */
export const VERIFICATION_TYPES = [
  "IDENTITY",
  "LEGAL_DOCUMENT",
  "BANK_ACCOUNT",
  "MANUAL_REVIEW",
] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

/** Label jenis verifikasi. */
export const VERIFICATION_TYPE_LABEL: Record<VerificationType, string> = {
  IDENTITY: "Identity",
  LEGAL_DOCUMENT: "Legal document",
  BANK_ACCOUNT: "Bank account",
  MANUAL_REVIEW: "Manual review",
};

/** Label jenis; kode yang tidak dikenal ditampilkan apa adanya. */
export function verificationTypeLabel(type: string): string {
  return VERIFICATION_TYPE_LABEL[type as VerificationType] ?? type;
}

/** Backend `OrganizationVerificationConstant::STATUS_*`. */
export const VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Satu verifikasi (`OrganizationVerificationData::toArray`). `organization_name` BELUM dikirim
 * backend asli, jadi opsional (layar mencarinya di daftar organisasi).
 */
export type ApiOrganizationVerification = {
  uuid: string;
  organization_uuid: string;
  organization_name?: string | null;
  verification_type: string;
  status: string;
  rejection_reason: string | null;
};

/** Satu verifikasi untuk layar. */
export type OrganizationVerification = {
  id: string;
  organizationId: string;
  /** Null bila backend belum mengirim nama organisasi. */
  organizationName: string | null;
  type: string;
  status: string;
  rejectionReason: string;
};

/** Baris API -> verifikasi layar. */
export function verificationFromApi(
  row: ApiOrganizationVerification,
): OrganizationVerification {
  return {
    id: row.uuid,
    organizationId: row.organization_uuid,
    organizationName: row.organization_name ?? null,
    type: row.verification_type,
    status: row.status,
    rejectionReason: row.rejection_reason ?? "",
  };
}
