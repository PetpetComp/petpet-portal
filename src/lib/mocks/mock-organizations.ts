import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  INVITABLE_ROLES,
  MEMBER_ROLES,
  VERIFICATION_TYPES,
  WAITING_APPLICATION_STATUSES,
  OPEN_APPLICATION_STATUSES,
  type ApiOrganization,
  type ApiOrganizationInvitation,
  type ApiOrganizationMember,
  type ApiOrganizationVerification,
  type ApiOrganizerApplication,
  type MemberRole,
  type OrganizerApplicationStatus,
  type VerificationStatus,
} from "@/domains/organizations/types";
import { mockAccess } from "./mock-access";
import { forbidUnless, iso } from "./mock-records";
import { nextUuid, store } from "./mock-store";
import type {
  MockOrganization,
  MockOrganizationMember,
  MockUser,
} from "./mock-types";

/**
 * Backend palsu untuk Organizations: organisasi, anggota, undangan, pengajuan organizer,
 * dan verifikasi. Bentuk response dan aturannya mengikuti kode backend
 * (`OrganizationService`, `OrganizerApplicationService`, `ChecksOrgRole`) dan draf kontrak
 * organizations. Dipanggil dari route `/organizations*`, `/organizer-applications*`,
 * `/verifications*`, `/invitations*` di mock-request.ts.
 *
 * Urutan cek seperti backend: validasi body (FormRequest, 422), organisasi tidak ada (404),
 * pemanggil (403), lalu aturan data (422). Keanggotaan hidup di `store.organizations[].pics`
 * supaya `/auth/me` dan pencarian user memakai sumber yang sama.
 */

// ---------------------------------------------------------------------------
// Tipe dan data awal
// ---------------------------------------------------------------------------

/** Pengajuan tersimpan. Nama dan email pengaju ditambahkan saat dikirim (`applicationRecord`). */
export type MockOrganizerApplication = {
  uuid: string;
  proposed_organization_name: string;
  organization_type: string | null;
  description: string | null;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  status: OrganizerApplicationStatus;
  review_note: string | null;
  approved_organization_uuid: string | null;
  applicant_user_uuid: string;
};

/** Undangan tersimpan, lengkap dengan token mentah (backend hanya menyimpan hash-nya). */
export type MockOrganizationInvitation = {
  uuid: string;
  organization_uuid: string;
  email: string;
  member_role: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  expires_at: string;
};

/** Verifikasi organisasi tersimpan. */
export type MockOrganizationVerification = {
  uuid: string;
  organization_uuid: string;
  verification_type: string;
  status: VerificationStatus;
  rejection_reason: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Masa berlaku undangan baru (backend: `now()->addDays(7)`). */
const INVITATION_TTL_DAYS = 7;

const ORG_PETPET = "org-petpet-community";
const ORG_EAST_JAVA = "org-east-java-pet-sport";

/** Data awal pengajuan: terbaru dulu. Dua menunggu, satu ditolak (supaya bisa mengajukan lagi). */
function seedApplications(): MockOrganizerApplication[] {
  return [
    {
      uuid: "app-bekasi-pet-club",
      proposed_organization_name: "Bekasi Pet Club",
      organization_type: "COMMUNITY",
      description: "Weekend meetups and small agility races for glider owners.",
      contact_email: "hello@bekasipet.id",
      contact_phone: null,
      address: "Jl. Ahmad Yani No. 5, Bekasi",
      status: "SUBMITTED",
      review_note: null,
      approved_organization_uuid: null,
      applicant_user_uuid: "u-competitor-2",
    },
    {
      uuid: "app-solo-glider",
      proposed_organization_name: "Solo Glider Society",
      organization_type: "COMMUNITY",
      description: null,
      contact_email: "admin@sologlider.id",
      contact_phone: "081233340001",
      address: "Jl. Slamet Riyadi No. 8, Solo",
      status: "UNDER_REVIEW",
      review_note: null,
      approved_organization_uuid: null,
      applicant_user_uuid: "u-competitor-3",
    },
    {
      uuid: "app-depok-pet-lovers",
      proposed_organization_name: "Depok Pet Lovers",
      organization_type: "COMMUNITY",
      description: null,
      contact_email: "depok@petlovers.id",
      contact_phone: null,
      address: null,
      status: "REJECTED",
      review_note: "Please add a contact phone number and a short description.",
      approved_organization_uuid: null,
      applicant_user_uuid: "u-competitor",
    },
  ];
}

/** Data awal undangan: satu masih berlaku dan satu sudah lewat (untuk chip Expired). */
function seedInvitations(): MockOrganizationInvitation[] {
  const now = Date.now();
  return [
    {
      uuid: "oinv-petpet-1",
      organization_uuid: ORG_PETPET,
      email: "farah.invited@example.com",
      member_role: "STAFF",
      token: "mock-token-petpet-1",
      status: "PENDING",
      expires_at: iso(new Date(now + 5 * DAY_MS)),
    },
    {
      uuid: "oinv-east-java-1",
      organization_uuid: ORG_EAST_JAVA,
      email: "new.admin@example.com",
      member_role: "ADMIN",
      token: "mock-token-east-java-1",
      status: "PENDING",
      expires_at: iso(new Date(now + 3 * DAY_MS)),
    },
    {
      uuid: "oinv-east-java-2",
      organization_uuid: ORG_EAST_JAVA,
      email: "late.reply@example.com",
      member_role: "STAFF",
      token: "mock-token-east-java-2",
      status: "PENDING",
      expires_at: iso(new Date(now - 2 * DAY_MS)),
    },
  ];
}

/** Data awal verifikasi: Petpet Community punya satu terverifikasi dan satu ditolak; East Java menunggu. */
function seedVerifications(): MockOrganizationVerification[] {
  return [
    {
      uuid: "ver-east-java-identity",
      organization_uuid: ORG_EAST_JAVA,
      verification_type: "IDENTITY",
      status: "PENDING",
      rejection_reason: null,
    },
    {
      uuid: "ver-petpet-identity",
      organization_uuid: ORG_PETPET,
      verification_type: "IDENTITY",
      status: "VERIFIED",
      rejection_reason: null,
    },
    {
      uuid: "ver-petpet-legal",
      organization_uuid: ORG_PETPET,
      verification_type: "LEGAL_DOCUMENT",
      status: "REJECTED",
      rejection_reason:
        "The document is not readable. Please upload a clearer copy.",
    },
  ];
}

/** Data yang hanya dipakai organisasi. Daftar anggota ada di `store.organizations`. */
export const organizationStore = {
  applications: seedApplications(),
  invitations: seedInvitations(),
  verifications: seedVerifications(),
};

/** Mengembalikan data pengajuan, undangan, dan verifikasi ke keadaan awal. Dipakai test. */
export function resetOrganizationStore() {
  organizationStore.applications = seedApplications();
  organizationStore.invitations = seedInvitations();
  organizationStore.verifications = seedVerifications();
}

// ---------------------------------------------------------------------------
// Pembantu umum
// ---------------------------------------------------------------------------

/** Aturan validasi satu field body, bentuknya sengaja mirip `rules()` FormRequest Laravel. */
type FieldRule = {
  field: string;
  required?: boolean;
  /** Bila true: field boleh tidak dikirim, tetapi kalau dikirim tidak boleh kosong (`sometimes|string`). */
  sometimes?: boolean;
  max?: number;
  email?: boolean;
  oneOf?: readonly string[];
};

/** Nama field untuk pesan, seperti Laravel: garis bawah menjadi spasi. */
const labelOf = (field: string) => field.replace(/_/g, " ");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Melempar 422 dengan pesan per field, seperti validasi Laravel. */
function invalid(errors: Record<string, string[]>): never {
  throw new ApiError(422, Object.values(errors).flat().join(" "), errors);
}

/**
 * Memeriksa body terhadap `rules`. Melempar 422 `{ errors: { field: [pesan] } }` bila ada yang salah.
 * Dipanggil lebih dulu dari cek lain, seperti FormRequest yang berjalan sebelum controller.
 */
function validateBody(
  body: Record<string, unknown> | undefined,
  rules: FieldRule[],
) {
  const errors: Record<string, string[]> = {};
  for (const rule of rules) {
    const value = body?.[rule.field];
    const label = labelOf(rule.field);
    if (rule.sometimes && value === undefined) continue;
    const text = typeof value === "string" ? value.trim() : value;
    const empty = value === undefined || value === null || text === "";
    if (empty) {
      if (rule.required)
        errors[rule.field] = [`The ${label} field is required.`];
      else if (rule.sometimes)
        errors[rule.field] = [`The ${label} field must be a string.`];
      continue;
    }
    if (typeof text !== "string") {
      errors[rule.field] = [`The ${label} field must be a string.`];
    } else if (rule.max !== undefined && text.length > rule.max) {
      errors[rule.field] = [
        `The ${label} field must not be greater than ${rule.max} characters.`,
      ];
    } else if (rule.email && !EMAIL_PATTERN.test(text)) {
      errors[rule.field] = [
        `The ${label} field must be a valid email address.`,
      ];
    } else if (rule.oneOf && !rule.oneOf.includes(text)) {
      errors[rule.field] = [`The selected ${label} is invalid.`];
    }
  }
  if (Object.keys(errors).length > 0) invalid(errors);
}

/** String dari body atau null bila kosong (Laravel mengubah "" menjadi null). */
const textOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
};

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const isSuperAdmin = (user: MockUser) =>
  mockAccess(user).roles.some((role) => role.code === "SUPER_ADMIN");

/** Organisasi dari uuid, atau 404 "Organization not found." (bukan Error biasa, supaya status 404 terbawa). */
function findOrganization(uuid: string): MockOrganization {
  const org = store.organizations.find((item) => item.uuid === uuid);
  if (!org) throw new ApiError(404, "Organization not found.");
  return org;
}

/**
 * Seperti `ChecksOrgRole::requireOrgRole`: super admin lolos (mengembalikan null), selain itu
 * harus anggota aktif dengan salah satu `roles`, kalau tidak 403.
 */
function requireOrgRole(
  user: MockUser,
  org: MockOrganization,
  roles: readonly string[],
): MockOrganizationMember | null {
  if (isSuperAdmin(user)) return null;
  const member = org.pics.find((pic) => pic.user_uuid === user.uuid);
  if (!member)
    throw new ApiError(403, "You are not a member of this organization.");
  if (!roles.includes(member.member_role ?? "ADMIN"))
    throw new ApiError(
      403,
      "Your role in this organization does not permit this action.",
    );
  return member;
}

/** Hanya pemegang `organization.verify` (super admin). 403 bila tidak. */
function requireVerify(user: MockUser) {
  forbidUnless(
    mockAccess(user).permissions.includes(PERMISSION.ORGANIZATION_VERIFY),
  );
}

/** Peran di organisasi; data lama tanpa peran dibaca ADMIN. */
const roleOf = (pic: MockOrganizationMember): string =>
  pic.member_role ?? "ADMIN";

const ownerCount = (org: MockOrganization) =>
  org.pics.filter((pic) => roleOf(pic) === "OWNER").length;

const LAST_OWNER_MESSAGE =
  "The last owner of an organization cannot be removed or demoted.";

/** Query untuk `paginate`: per_page bawaan 15 seperti controller backend (`input('per_page', 15)`). */
function withDefaultPerPage(query: URLSearchParams): URLSearchParams {
  const copy = new URLSearchParams(query);
  if (!copy.get("per_page")) copy.set("per_page", "15");
  return copy;
}

/** Potong satu halaman dan bentuk `{ items, meta }` seperti response backend. */
function page<T>(items: T[], query: URLSearchParams) {
  const q = withDefaultPerPage(query);
  const pageNumber = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const perPage = Math.max(1, Number(q.get("per_page")) || 15);
  const start = (pageNumber - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    meta: {
      current_page: pageNumber,
      per_page: perPage,
      total: items.length,
      last_page: Math.max(1, Math.ceil(items.length / perPage)),
    },
  };
}

// ---------------------------------------------------------------------------
// Organisasi
// ---------------------------------------------------------------------------

/** Organisasi tersimpan -> `ApiOrganization` (`OrganizationData::toArray`). */
export function organizationRecord(org: MockOrganization): ApiOrganization {
  return {
    uuid: org.uuid,
    name: org.name,
    slug: org.slug ?? slugify(org.name),
    description: org.description ?? null,
    email: org.email ?? null,
    phone: org.phone ?? null,
    address: org.address ?? null,
    status: "ACTIVE",
    sponsor_uuid: null,
  };
}

/**
 * `GET /organizations`: hanya organisasi aktif, urut nama, tanpa login. `q` (cari nama) hanya
 * ada di mock (kontrak: "Hanya di mock").
 */
export function listOrganizationRecords(query: URLSearchParams) {
  const q = (query.get("q") ?? "").trim().toLowerCase();
  const rows = store.organizations
    .filter((org) => !q || org.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(organizationRecord);
  return page(rows, query);
}

/** `GET /organizations/{uuid}` (publik, 404 bila tidak ada). */
export function getOrganizationRecord(uuid: string): ApiOrganization {
  return organizationRecord(findOrganization(uuid));
}

/**
 * `PATCH /organizations/{uuid}`: OWNER atau ADMIN (super admin lolos). Hanya field yang
 * dikirim yang diubah; slug tidak berubah walau nama berganti (seperti backend).
 */
export function updateOrganizationRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiOrganization {
  validateBody(body, [
    { field: "name", sometimes: true, max: 200 },
    { field: "description" },
    { field: "email", email: true, max: 255 },
    { field: "phone", max: 30 },
    { field: "address" },
  ]);
  const org = findOrganization(uuid);
  requireOrgRole(user, org, ["OWNER", "ADMIN"]);
  org.slug ??= slugify(org.name);
  if (body && "name" in body) org.name = String(body.name).trim();
  if (body && "description" in body)
    org.description = textOrNull(body.description) ?? undefined;
  if (body && "email" in body) org.email = textOrNull(body.email) ?? undefined;
  if (body && "phone" in body) org.phone = textOrNull(body.phone) ?? undefined;
  if (body && "address" in body)
    org.address = textOrNull(body.address) ?? undefined;
  return organizationRecord(org);
}

// ---------------------------------------------------------------------------
// Anggota
// ---------------------------------------------------------------------------

/** Anggota tersimpan -> `ApiOrganizationMember` (nama dan email dari user). */
export function memberRecord(
  pic: MockOrganizationMember,
): ApiOrganizationMember {
  const user = store.users.find((u) => u.uuid === pic.user_uuid);
  return {
    uuid: pic.uuid,
    user_uuid: pic.user_uuid,
    user_name: user ? fullName(user) : pic.name,
    user_email: user?.email ?? null,
    member_role: roleOf(pic),
    status: "ACTIVE",
  };
}

/** `GET /organizations/{uuid}/members`: array DATAR, untuk anggota apa pun atau super admin. */
export function listMemberRecords(
  user: MockUser,
  orgUuid: string,
): ApiOrganizationMember[] {
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, MEMBER_ROLES);
  return org.pics.map(memberRecord);
}

/** Anggota organisasi menurut uuid user, atau 404 "Member not found.". */
function findMember(org: MockOrganization, userUuid: string) {
  const pic = org.pics.find((item) => item.user_uuid === userUuid);
  if (!pic) throw new ApiError(404, "Member not found.");
  return pic;
}

/** `PATCH /organizations/{uuid}/members/{userUuid}`: hanya OWNER. Owner terakhir tidak bisa diturunkan. */
export function changeMemberRoleRecord(
  user: MockUser,
  orgUuid: string,
  userUuid: string,
  body: Record<string, unknown> | undefined,
): ApiOrganizationMember {
  validateBody(body, [
    { field: "member_role", required: true, oneOf: MEMBER_ROLES },
  ]);
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, ["OWNER"]);
  const member = findMember(org, userUuid);
  const newRole = String(body?.member_role) as MemberRole;
  if (roleOf(member) === "OWNER" && newRole !== "OWNER" && ownerCount(org) <= 1)
    throw new ApiError(422, LAST_OWNER_MESSAGE);
  member.member_role = newRole;
  return memberRecord(member);
}

/**
 * `DELETE /organizations/{uuid}/members/{userUuid}`: OWNER atau ADMIN. ADMIN tidak boleh
 * menghapus OWNER (403), owner terakhir tidak boleh dihapus (422).
 */
export function removeMemberRecord(
  user: MockUser,
  orgUuid: string,
  userUuid: string,
): null {
  const org = findOrganization(orgUuid);
  const actor = requireOrgRole(user, org, ["OWNER", "ADMIN"]);
  const target = findMember(org, userUuid);
  if (actor && roleOf(actor) === "ADMIN" && roleOf(target) === "OWNER")
    throw new ApiError(403, "An admin cannot remove an owner.");
  if (roleOf(target) === "OWNER" && ownerCount(org) <= 1)
    throw new ApiError(422, LAST_OWNER_MESSAGE);
  org.pics = org.pics.filter((pic) => pic !== target);
  return null;
}

// ---------------------------------------------------------------------------
// Undangan organisasi
// ---------------------------------------------------------------------------

/** Undangan tersimpan -> `ApiOrganizationInvitation`. `token` hanya dikirim bila `withToken` (response POST). */
export function invitationRecord(
  invite: MockOrganizationInvitation,
  withToken = false,
): ApiOrganizationInvitation {
  const org = findOrganization(invite.organization_uuid);
  return {
    uuid: invite.uuid,
    organization_name: org.name,
    email: invite.email,
    member_role: invite.member_role,
    status: invite.status,
    expires_at: invite.expires_at,
    ...(withToken ? { token: invite.token } : {}),
  };
}

/**
 * `POST /organizations/{uuid}/invitations`: OWNER atau ADMIN. Peran hanya ADMIN atau STAFF.
 * Backend asli belum menolak email yang sudah menjadi anggota atau undangan Pending ganda;
 * mock menolaknya dengan 422 di field `email` (usulan kontrak, doc 09).
 */
export function createOrganizationInvitationRecord(
  user: MockUser,
  orgUuid: string,
  body: Record<string, unknown> | undefined,
): ApiOrganizationInvitation {
  validateBody(body, [
    { field: "email", required: true, email: true, max: 255 },
    { field: "member_role", required: true, oneOf: INVITABLE_ROLES },
  ]);
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, ["OWNER", "ADMIN"]);
  const email = String(body?.email).trim();
  const existingUser = store.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (
    existingUser &&
    org.pics.some((pic) => pic.user_uuid === existingUser.uuid)
  )
    invalid({
      email: ["This person is already a member of this organization."],
    });
  if (
    organizationStore.invitations.some(
      (i) =>
        i.organization_uuid === org.uuid &&
        i.status === "PENDING" &&
        i.email.toLowerCase() === email.toLowerCase(),
    )
  )
    invalid({
      email: ["There is already a pending invitation for this email."],
    });
  const invite: MockOrganizationInvitation = {
    uuid: nextUuid(),
    organization_uuid: org.uuid,
    email,
    member_role: String(body?.member_role),
    token: nextUuid().replace(/-/g, ""),
    status: "PENDING",
    expires_at: iso(new Date(Date.now() + INVITATION_TTL_DAYS * DAY_MS)),
  };
  organizationStore.invitations.unshift(invite);
  return invitationRecord(invite, true);
}

/** `GET /organizations/{uuid}/invitations`: array datar berisi yang Pending (termasuk yang sudah lewat masa berlaku). */
export function listOrganizationInvitationRecords(
  user: MockUser,
  orgUuid: string,
): ApiOrganizationInvitation[] {
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, ["OWNER", "ADMIN"]);
  return organizationStore.invitations
    .filter((i) => i.organization_uuid === org.uuid && i.status === "PENDING")
    .map((i) => invitationRecord(i));
}

/** `DELETE /organizations/{uuid}/invitations/{invitationUuid}`: OWNER atau ADMIN; 404 bila bukan milik organisasi itu. */
export function revokeOrganizationInvitationRecord(
  user: MockUser,
  orgUuid: string,
  invitationUuid: string,
): null {
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, ["OWNER", "ADMIN"]);
  const invite = organizationStore.invitations.find(
    (i) => i.uuid === invitationUuid && i.organization_uuid === org.uuid,
  );
  if (!invite) throw new ApiError(404, "Invitation not found.");
  invite.status = "REVOKED";
  return null;
}

/** Undangan dari token, atau 404 "Invitation not found.". */
function findInvitationByToken(token: string): MockOrganizationInvitation {
  const invite = organizationStore.invitations.find((i) => i.token === token);
  if (!invite) throw new ApiError(404, "Invitation not found.");
  return invite;
}

/** `GET /invitations/{token}`: publik, dipakai layar penerima undangan. */
export function lookupInvitationRecord(
  token: string,
): ApiOrganizationInvitation {
  return invitationRecord(findInvitationByToken(token));
}

/**
 * `POST /invitations/{token}/accept`: user yang login dengan email yang sama menjadi anggota
 * dengan peran undangan. 422 bila tidak lagi pending atau sudah anggota, 410 bila kedaluwarsa,
 * 403 bila email berbeda.
 */
export function acceptInvitationRecord(user: MockUser, token: string): null {
  const invite = findInvitationByToken(token);
  if (invite.status !== "PENDING")
    throw new ApiError(422, "This invitation is no longer pending.");
  if (new Date(invite.expires_at).getTime() < Date.now())
    throw new ApiError(410, "This invitation has expired.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase())
    throw new ApiError(
      403,
      "This invitation was sent to a different email address.",
    );
  const org = findOrganization(invite.organization_uuid);
  if (org.pics.some((pic) => pic.user_uuid === user.uuid))
    throw new ApiError(422, "You are already a member of this organization.");
  org.pics.push({
    uuid: nextUuid(),
    name: fullName(user),
    user_uuid: user.uuid,
    member_role: invite.member_role as MemberRole,
  });
  invite.status = "ACCEPTED";
  return null;
}

/** `POST /invitations/{token}/decline`. */
export function declineInvitationRecord(user: MockUser, token: string): null {
  const invite = findInvitationByToken(token);
  if (invite.status !== "PENDING")
    throw new ApiError(422, "This invitation is no longer pending.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase())
    throw new ApiError(
      403,
      "This invitation was sent to a different email address.",
    );
  invite.status = "DECLINED";
  return null;
}

// ---------------------------------------------------------------------------
// Pengajuan organizer
// ---------------------------------------------------------------------------

/** Pengajuan tersimpan -> `ApiOrganizerApplication` (nama dan email pengaju dari user). */
export function applicationRecord(
  app: MockOrganizerApplication,
): ApiOrganizerApplication {
  const applicant = store.users.find((u) => u.uuid === app.applicant_user_uuid);
  return {
    uuid: app.uuid,
    proposed_organization_name: app.proposed_organization_name,
    organization_type: app.organization_type,
    description: app.description,
    contact_email: app.contact_email,
    contact_phone: app.contact_phone,
    address: app.address,
    status: app.status,
    review_note: app.review_note,
    approved_organization_uuid: app.approved_organization_uuid,
    applicant_name: applicant ? fullName(applicant) : null,
    applicant_email: applicant?.email ?? null,
  };
}

/** Pengajuan dari uuid, atau 404 "Organizer application not found.". */
function findApplication(uuid: string): MockOrganizerApplication {
  const app = organizationStore.applications.find((a) => a.uuid === uuid);
  if (!app) throw new ApiError(404, "Organizer application not found.");
  return app;
}

const isWaiting = (app: MockOrganizerApplication) =>
  (WAITING_APPLICATION_STATUSES as readonly string[]).includes(app.status);

const ALREADY_REVIEWED_MESSAGE = "This application has already been reviewed.";

/**
 * `POST /organizer-applications`: semua user login. Satu user hanya boleh punya satu pengajuan
 * terbuka (422 "You already have an application in progress.").
 */
export function submitApplicationRecord(
  user: MockUser,
  body: Record<string, unknown> | undefined,
): ApiOrganizerApplication {
  validateBody(body, [
    { field: "proposed_organization_name", required: true, max: 200 },
    { field: "organization_type", max: 50 },
    { field: "description" },
    { field: "contact_email", required: true, email: true, max: 255 },
    { field: "contact_phone", max: 30 },
    { field: "address" },
  ]);
  const hasOpen = organizationStore.applications.some(
    (a) =>
      a.applicant_user_uuid === user.uuid &&
      (OPEN_APPLICATION_STATUSES as readonly string[]).includes(a.status),
  );
  if (hasOpen)
    throw new ApiError(422, "You already have an application in progress.");
  const app: MockOrganizerApplication = {
    uuid: nextUuid(),
    proposed_organization_name: String(body?.proposed_organization_name).trim(),
    organization_type: textOrNull(body?.organization_type),
    description: textOrNull(body?.description),
    contact_email: String(body?.contact_email).trim(),
    contact_phone: textOrNull(body?.contact_phone),
    address: textOrNull(body?.address),
    status: "SUBMITTED",
    review_note: null,
    approved_organization_uuid: null,
    applicant_user_uuid: user.uuid,
  };
  organizationStore.applications.unshift(app);
  return applicationRecord(app);
}

/** `GET /organizer-applications/me`: pengajuan sendiri, terbaru dulu, array datar. */
export function listMyApplicationRecords(
  user: MockUser,
): ApiOrganizerApplication[] {
  return organizationStore.applications
    .filter((a) => a.applicant_user_uuid === user.uuid)
    .map(applicationRecord);
}

/** `GET /organizer-applications`: butuh `organization.verify`. Filter `status`, terbaru dulu. */
export function listApplicationRecords(user: MockUser, query: URLSearchParams) {
  requireVerify(user);
  const status = query.get("status");
  const rows = organizationStore.applications
    .filter((a) => !status || a.status === status)
    .map(applicationRecord);
  return page(rows, query);
}

/**
 * `DELETE /organizer-applications/{uuid}`: hanya pengaju (403 "This is not your application.")
 * dan hanya DRAFT atau SUBMITTED (422).
 */
export function cancelApplicationRecord(user: MockUser, uuid: string): null {
  const app = findApplication(uuid);
  if (app.applicant_user_uuid !== user.uuid)
    throw new ApiError(403, "This is not your application.");
  if (app.status !== "DRAFT" && app.status !== "SUBMITTED")
    throw new ApiError(422, "This application can no longer be cancelled.");
  app.status = "CANCELLED";
  return null;
}

/** Slug unik dari nama: "klub-a", lalu "klub-a-2", "klub-a-3", seperti `OrganizerApplicationService::approve`. */
function uniqueSlug(name: string): string {
  const base = slugify(name);
  const taken = new Set(
    store.organizations.map((o) => o.slug ?? slugify(o.name)),
  );
  let candidate = base;
  let suffix = 1;
  while (taken.has(candidate)) candidate = `${base}-${++suffix}`;
  return candidate;
}

/**
 * `POST /organizer-applications/{uuid}/approve`: butuh `organization.verify`. Hanya dari
 * SUBMITTED atau UNDER_REVIEW. Membuat organisasi dan menjadikan pengaju OWNER, sehingga
 * `/auth/me` pengaju ikut berubah (jadi organizer).
 */
export function approveApplicationRecord(
  user: MockUser,
  uuid: string,
): ApiOrganizerApplication {
  requireVerify(user);
  const app = findApplication(uuid);
  if (!isWaiting(app)) throw new ApiError(422, ALREADY_REVIEWED_MESSAGE);
  const applicant = store.users.find((u) => u.uuid === app.applicant_user_uuid);
  const org: MockOrganization = {
    uuid: nextUuid(),
    name: app.proposed_organization_name,
    slug: uniqueSlug(app.proposed_organization_name),
    description: app.description ?? undefined,
    email: app.contact_email,
    phone: app.contact_phone ?? undefined,
    address: app.address ?? undefined,
    pics: [
      {
        uuid: nextUuid(),
        name: applicant ? fullName(applicant) : "Owner",
        user_uuid: app.applicant_user_uuid,
        member_role: "OWNER",
      },
    ],
  };
  store.organizations.push(org);
  app.status = "APPROVED";
  app.approved_organization_uuid = org.uuid;
  return applicationRecord(app);
}

/** `POST /organizer-applications/{uuid}/reject`: catatan wajib (maks 1000). Validasi lebih dulu dari izin. */
export function rejectApplicationRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiOrganizerApplication {
  validateBody(body, [{ field: "review_note", required: true, max: 1000 }]);
  requireVerify(user);
  const app = findApplication(uuid);
  if (!isWaiting(app)) throw new ApiError(422, ALREADY_REVIEWED_MESSAGE);
  app.status = "REJECTED";
  app.review_note = String(body?.review_note).trim();
  return applicationRecord(app);
}

// ---------------------------------------------------------------------------
// Verifikasi organisasi
// ---------------------------------------------------------------------------

/** Verifikasi tersimpan -> `ApiOrganizationVerification` (`organization_name` ditambahkan mock). */
export function verificationRecord(
  v: MockOrganizationVerification,
): ApiOrganizationVerification {
  const org = findOrganization(v.organization_uuid);
  return {
    uuid: v.uuid,
    organization_uuid: org.uuid,
    organization_name: org.name,
    verification_type: v.verification_type,
    status: v.status,
    rejection_reason: v.rejection_reason,
  };
}

/** Verifikasi dari uuid, atau 404 "Verification record not found.". */
function findVerification(uuid: string): MockOrganizationVerification {
  const v = organizationStore.verifications.find((item) => item.uuid === uuid);
  if (!v) throw new ApiError(404, "Verification record not found.");
  return v;
}

/**
 * `POST /organizations/{uuid}/verifications`: hanya OWNER. Satu per jenis; yang REJECTED
 * kembali PENDING (diajukan ulang), selain itu 422.
 */
export function submitVerificationRecord(
  user: MockUser,
  orgUuid: string,
  body: Record<string, unknown> | undefined,
): ApiOrganizationVerification {
  validateBody(body, [
    { field: "verification_type", required: true, oneOf: VERIFICATION_TYPES },
  ]);
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, ["OWNER"]);
  const type = String(body?.verification_type);
  const existing = organizationStore.verifications.find(
    (v) => v.organization_uuid === org.uuid && v.verification_type === type,
  );
  if (existing && existing.status === "REJECTED") {
    existing.status = "PENDING";
    existing.rejection_reason = null;
    return verificationRecord(existing);
  }
  if (existing)
    throw new ApiError(
      422,
      "A verification of this type has already been submitted.",
    );
  const created: MockOrganizationVerification = {
    uuid: nextUuid(),
    organization_uuid: org.uuid,
    verification_type: type,
    status: "PENDING",
    rejection_reason: null,
  };
  organizationStore.verifications.unshift(created);
  return verificationRecord(created);
}

/** `GET /organizations/{uuid}/verifications`: array datar, untuk anggota apa pun atau super admin. */
export function listOrganizationVerificationRecords(
  user: MockUser,
  orgUuid: string,
): ApiOrganizationVerification[] {
  const org = findOrganization(orgUuid);
  requireOrgRole(user, org, MEMBER_ROLES);
  return organizationStore.verifications
    .filter((v) => v.organization_uuid === org.uuid)
    .map(verificationRecord);
}

/** `GET /verifications`: antrean untuk pemegang `organization.verify`, filter `status`, terbaru dulu. */
export function listVerificationQueueRecords(
  user: MockUser,
  query: URLSearchParams,
) {
  requireVerify(user);
  const status = query.get("status");
  const rows = organizationStore.verifications
    .filter((v) => !status || v.status === status)
    .map(verificationRecord);
  return page(rows, query);
}

const VERIFICATION_REVIEWED_MESSAGE =
  "This verification has already been reviewed.";

/** `POST /verifications/{uuid}/approve`: butuh `organization.verify`; hanya dari PENDING. */
export function approveVerificationRecord(
  user: MockUser,
  uuid: string,
): ApiOrganizationVerification {
  requireVerify(user);
  const v = findVerification(uuid);
  if (v.status !== "PENDING")
    throw new ApiError(422, VERIFICATION_REVIEWED_MESSAGE);
  v.status = "VERIFIED";
  return verificationRecord(v);
}

/** `POST /verifications/{uuid}/reject`: alasan wajib (maks 1000). Validasi lebih dulu dari izin. */
export function rejectVerificationRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiOrganizationVerification {
  validateBody(body, [
    { field: "rejection_reason", required: true, max: 1000 },
  ]);
  requireVerify(user);
  const v = findVerification(uuid);
  if (v.status !== "PENDING")
    throw new ApiError(422, VERIFICATION_REVIEWED_MESSAGE);
  v.status = "REJECTED";
  v.rejection_reason = String(body?.rejection_reason).trim();
  return verificationRecord(v);
}
