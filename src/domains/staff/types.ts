/**
 * Tipe domain Committee (penugasan staf dan undangan). Bentuk `Api*` mengikuti kontrak
 * petpet-docs/13-kontrak-api-mock.md bagian 3. Tipe layar dibuat hanya oleh mapper `*FromApi`.
 */

/** Cakupan peran: EVENT = hanya tim event, COMPETITION = hanya satu kompetisi. */
export const ASSIGNMENT_ROLE_SCOPES = ["EVENT", "COMPETITION"] as const;
export type AssignmentRoleScope = (typeof ASSIGNMENT_ROLE_SCOPES)[number];

/** Status penugasan (backend `StaffConstant::ASSIGNMENT_STATUS_*`). Layar hanya menampilkan ACTIVE. */
export const ASSIGNMENT_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Status undangan (backend `StaffConstant::INVITATION_STATUS_*`). Layar hanya menampilkan PENDING. */
export const INVITATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "REVOKED",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** Satu peran dari `GET /master/assignment-roles`. */
export type ApiAssignmentRole = {
  code: string;
  label: string;
  scope: AssignmentRoleScope;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

/** Apa yang boleh dilakukan pemanggil pada satu penugasan atau undangan (aturan dipegang backend). */
export type ApiStaffActions = { revoke: boolean };

/**
 * Satu penugasan dari `GET /events/{uuid}/staff` atau `/competitions/{uuid}/staff`.
 * `user_email` dan `actions` BELUM dikirim backend asli (doc 09 bagian N), jadi opsional:
 * layar tetap jalan tanpa keduanya, hanya tombol Remove yang tersembunyi.
 */
export type ApiStaffAssignment = {
  uuid: string;
  user_uuid: string;
  user_name: string;
  user_email?: string | null;
  competition_uuid: string | null;
  assignment_role: string;
  status: AssignmentStatus;
  actions?: ApiStaffActions;
};

/**
 * Satu undangan dari `GET /staff-invitations` (array datar) atau hasil `POST`.
 * `invitee_name` dan `actions` belum dikirim backend asli. `token` (hanya di respons POST
 * backend asli) sengaja tidak dipakai layar.
 */
export type ApiStaffInvitation = {
  uuid: string;
  event_uuid: string | null;
  competition_uuid: string | null;
  email: string;
  assignment_role: string;
  status: InvitationStatus;
  expires_at: string | null;
  invitee_name?: string | null;
  actions?: ApiStaffActions;
};

/** Body `POST /staff-invitations`. `competition_id` kosong = tim event. */
export type ApiStaffInvitationBody = {
  event_id: string;
  competition_id?: string;
  email: string;
  assignment_role: string;
};

/** Peran untuk layar (dropdown, label chip). Dibuat oleh `roleFromApi`. */
export type AssignmentRole = {
  code: string;
  label: string;
  scope: AssignmentRoleScope;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

/** Satu anggota (penugasan aktif) di daftar Committee. */
export type StaffMember = {
  id: string;
  userId: string;
  name: string;
  /** Null bila backend belum mengirim email. */
  email: string | null;
  /** Null = tim event. */
  competitionId: string | null;
  /** Kode peran mentah; labelnya dicari lewat daftar peran. */
  role: string;
  /** True hanya bila API mengirim `actions.revoke = true`. */
  canRevoke: boolean;
};

/** Satu undangan PENDING di daftar Committee. */
export type PendingInvitation = {
  id: string;
  eventId: string | null;
  competitionId: string | null;
  email: string;
  /** Nama bila email itu sudah punya akun (kontrak), selain itu null. */
  inviteeName: string | null;
  role: string;
  /** Null bila backend tidak mengirim masa berlaku. */
  expiresAt: string | null;
  canRevoke: boolean;
};

/** Target undangan di drawer: satu pilihan di dropdown "Where". */
export type InviteTarget =
  { kind: "event" } | { kind: "competition"; competitionId: string };

/**
 * Daftar peran cadangan, sama dengan tabel di kontrak 13 bagian 3 (`StaffConstant::ROLES`).
 * Dipakai HANYA bila `GET /master/assignment-roles` gagal atau belum ada di backend asli.
 * Hapus konstanta ini setelah endpoint itu tersedia di backend (doc 09 bagian N).
 */
export const FALLBACK_ASSIGNMENT_ROLES: ApiAssignmentRole[] = [
  {
    code: "EVENT_MANAGER",
    label: "Event manager",
    scope: "EVENT",
    description: "Runs the whole event",
    sort_order: 10,
    is_active: true,
  },
  {
    code: "COMPETITION_PIC",
    label: "Competition PIC",
    scope: "COMPETITION",
    description: "Runs one competition",
    sort_order: 20,
    is_active: true,
  },
  {
    code: "HEAD_JUDGE",
    label: "Head judge",
    scope: "COMPETITION",
    description: "Leads the judges of a contest",
    sort_order: 60,
    is_active: true,
  },
  {
    code: "JUDGE",
    label: "Judge",
    scope: "COMPETITION",
    description: "Scores participants in a contest",
    sort_order: 50,
    is_active: true,
  },
  {
    code: "TIMER_OPERATOR",
    label: "Timer operator",
    scope: "COMPETITION",
    description: "Records times in a race",
    sort_order: 70,
    is_active: true,
  },
  {
    code: "MARSHAL",
    label: "Marshal",
    scope: "COMPETITION",
    description: "Keeps the track in order",
    sort_order: 80,
    is_active: true,
  },
];

/** Peran API -> peran layar. */
export function roleFromApi(row: ApiAssignmentRole): AssignmentRole {
  return {
    code: row.code,
    label: row.label,
    scope: row.scope,
    description: row.description ?? "",
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

/** Penugasan API -> anggota layar. Aman bila `user_email` atau `actions` belum dikirim backend. */
export function memberFromApi(row: ApiStaffAssignment): StaffMember {
  return {
    id: row.uuid,
    userId: row.user_uuid,
    name: row.user_name,
    email: row.user_email ?? null,
    competitionId: row.competition_uuid,
    role: row.assignment_role,
    canRevoke: row.actions?.revoke === true,
  };
}

/** Undangan API -> undangan layar. Aman bila `invitee_name` atau `actions` belum dikirim backend. */
export function invitationFromApi(row: ApiStaffInvitation): PendingInvitation {
  return {
    id: row.uuid,
    eventId: row.event_uuid,
    competitionId: row.competition_uuid,
    email: row.email,
    inviteeName: row.invitee_name ?? null,
    role: row.assignment_role,
    expiresAt: row.expires_at ?? null,
    canRevoke: row.actions?.revoke === true,
  };
}
