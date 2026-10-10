import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  FALLBACK_ASSIGNMENT_ROLES,
  type ApiAssignmentRole,
  type ApiStaffActions,
  type ApiStaffAssignment,
  type ApiStaffInvitation,
  type AssignmentRoleScope,
  type AssignmentStatus,
  type InvitationStatus,
} from "@/domains/staff/types";
import { callerFor, forbidUnless, hasPermission, iso } from "./mock-records";
import type { MockCaller } from "./mock-rules";
import { findOrThrow, nextUuid, paginate, store } from "./mock-store";
import type { MockUser } from "./mock-types";

/**
 * Backend palsu untuk Committee: peran penugasan, penugasan staf, dan undangan.
 * Bentuk response dan aturannya mengikuti kontrak 13 bagian 3 (petpet-docs).
 * Dipanggil dari route staf di mock-request.ts dan dari wizard New event (undang PIC).
 * Urutan cek seperti backend: pemanggil dulu (403), lalu data (422).
 */

/** Penugasan tersimpan. `ApiStaffAssignment` dibentuk saat dikirim (nama, email, actions). */
export type MockStaffAssignment = {
  uuid: string;
  event_uuid: string;
  /** Null = tim event. */
  competition_uuid: string | null;
  user_uuid: string;
  assignment_role: string;
  status: AssignmentStatus;
};

/** Undangan tersimpan. */
export type MockStaffInvitation = {
  uuid: string;
  event_uuid: string;
  competition_uuid: string | null;
  email: string;
  assignment_role: string;
  status: InvitationStatus;
  expires_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Masa berlaku undangan baru. */
const INVITATION_TTL_DAYS = 7;

const SURABAYA_EVENT_UUID = "evt-surabaya-paw-race";
const PAW_RACE_100M_UUID = "comp-paw-race-100m";

/**
 * Data awal: tim Surabaya Paw Race 2026 punya satu Event manager, dan Paw Race 100m punya
 * tiga PIC dan satu Judge (seperti desain Ev-Committee). Memakai user yang sudah ada di store.
 */
function seedAssignments(): MockStaffAssignment[] {
  const assign = (
    competitionUuid: string | null,
    userUuid: string,
    role: string,
  ): MockStaffAssignment => ({
    uuid: nextUuid(),
    event_uuid: SURABAYA_EVENT_UUID,
    competition_uuid: competitionUuid,
    user_uuid: userUuid,
    assignment_role: role,
    status: "ACTIVE",
  });
  return [
    assign(null, "u-organizer-3", "EVENT_MANAGER"),
    assign(PAW_RACE_100M_UUID, "u-competitor-2", "COMPETITION_PIC"),
    assign(PAW_RACE_100M_UUID, "u-competitor-3", "COMPETITION_PIC"),
    assign(PAW_RACE_100M_UUID, "u-competitor-4", "COMPETITION_PIC"),
    assign(PAW_RACE_100M_UUID, "u-competitor-5", "JUDGE"),
  ];
}

/** Salinan daftar peran awal (sama dengan kontrak), supaya mengubahnya di test tidak bocor. */
const seedRoles = (): ApiAssignmentRole[] =>
  FALLBACK_ASSIGNMENT_ROLES.map((role) => ({ ...role }));

export const staffStore = {
  roles: seedRoles(),
  assignments: seedAssignments(),
  invitations: [] as MockStaffInvitation[],
};

/** Mengembalikan data staf ke keadaan awal. Dipakai test. */
export function resetStaffStore() {
  staffStore.roles = seedRoles();
  staffStore.assignments = seedAssignments();
  staffStore.invitations = [];
}

/** Pesan 422 per field, seperti validasi Laravel. */
function invalid(errors: Record<string, string[]>): never {
  throw new ApiError(422, Object.values(errors).flat().join(" "), errors);
}

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

const userByEmail = (email: string) =>
  store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

/**
 * `actions` satu penugasan atau undangan (pola `entryActions` di mock-rules.ts).
 * Mencabut butuh `staff.manage` dan hak mengelola event itu (kontrak 13 bagian 3).
 */
export function staffActions(caller: MockCaller): ApiStaffActions {
  return {
    revoke:
      caller.managesEvent && hasPermission(caller, PERMISSION.STAFF_MANAGE),
  };
}

/** Penugasan tersimpan -> `ApiStaffAssignment` (nama dan email dari user, `actions` dari pemanggil). */
export function assignmentRecord(
  assignment: MockStaffAssignment,
  caller: MockCaller,
): ApiStaffAssignment {
  const user = store.users.find((u) => u.uuid === assignment.user_uuid);
  return {
    uuid: assignment.uuid,
    user_uuid: assignment.user_uuid,
    user_name: user ? fullName(user) : "Unknown user",
    user_email: user?.email ?? null,
    competition_uuid: assignment.competition_uuid,
    assignment_role: assignment.assignment_role,
    status: assignment.status,
    actions: staffActions(caller),
  };
}

/** Undangan tersimpan -> `ApiStaffInvitation` (`invitee_name` bila email itu sudah punya akun). */
export function invitationRecord(
  invitation: MockStaffInvitation,
  caller: MockCaller,
): ApiStaffInvitation {
  const user = userByEmail(invitation.email);
  return {
    uuid: invitation.uuid,
    event_uuid: invitation.event_uuid,
    competition_uuid: invitation.competition_uuid,
    email: invitation.email,
    assignment_role: invitation.assignment_role,
    status: invitation.status,
    expires_at: invitation.expires_at,
    invitee_name: user ? fullName(user) : null,
    actions: staffActions(caller),
  };
}

/** `GET /master/assignment-roles`: array datar, terurut menurut `sort_order`. */
export function listAssignmentRoles(): ApiAssignmentRole[] {
  return [...staffStore.roles].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * `GET /events/{uuid}/staff`: penugasan aktif tim event DAN semua kompetisi event itu.
 * Boleh dilihat siapa pun yang terkait dengan event (`relatedToEvent`).
 */
export function listEventStaff(
  user: MockUser,
  eventUuid: string,
  query: URLSearchParams,
) {
  findOrThrow(store.events, eventUuid, "Event");
  const caller = callerFor(user, eventUuid);
  forbidUnless(caller.relatedToEvent);
  const rows = staffStore.assignments.filter(
    (a) => a.event_uuid === eventUuid && a.status === "ACTIVE",
  );
  return paginate(
    rows.map((a) => assignmentRecord(a, caller)),
    query,
  );
}

/** `GET /competitions/{uuid}/staff`: penugasan aktif satu kompetisi. */
export function listCompetitionStaff(
  user: MockUser,
  competitionUuid: string,
  query: URLSearchParams,
) {
  const competition = findOrThrow(
    store.competitions,
    competitionUuid,
    "Competition",
  );
  const caller = callerFor(user, competition.event_uuid);
  forbidUnless(caller.relatedToEvent);
  const rows = staffStore.assignments.filter(
    (a) => a.competition_uuid === competitionUuid && a.status === "ACTIVE",
  );
  return paginate(
    rows.map((a) => assignmentRecord(a, caller)),
    query,
  );
}

/** Pemanggil boleh melihat undangan event ini: mengelola event dan punya `staff.invite` atau `staff.manage`. */
function mayListInvitations(caller: MockCaller): boolean {
  return (
    caller.managesEvent &&
    (hasPermission(caller, PERMISSION.STAFF_INVITE) ||
      hasPermission(caller, PERMISSION.STAFF_MANAGE))
  );
}

/**
 * `GET /staff-invitations`: array DATAR (bukan `{ items, meta }`), hanya PENDING dan belum
 * kedaluwarsa. Filter `event_id` dan `competition_id` opsional. Tanpa `event_id`, hanya undangan
 * event yang boleh dikelola pemanggil yang tampil (halaman lama memanggil tanpa filter).
 * Beda dengan backend asli yang meminta `staff.manage`: lihat doc 09 bagian N.
 */
export function listInvitations(
  user: MockUser,
  query: URLSearchParams,
  now = new Date(),
): ApiStaffInvitation[] {
  const eventId = query.get("event_id");
  const competitionId = query.get("competition_id");
  if (eventId) {
    findOrThrow(store.events, eventId, "Event");
    forbidUnless(mayListInvitations(callerFor(user, eventId)));
  }
  return staffStore.invitations
    .filter(
      (i) =>
        i.status === "PENDING" &&
        new Date(i.expires_at).getTime() > now.getTime() &&
        (!eventId || i.event_uuid === eventId) &&
        (!competitionId || i.competition_uuid === competitionId),
    )
    .flatMap((i) => {
      const caller = callerFor(user, i.event_uuid);
      return mayListInvitations(caller) ? [invitationRecord(i, caller)] : [];
    });
}

/**
 * Validasi data undangan (setelah cek pemanggil). Mengumpulkan semua pesan per field:
 * email, peran (ada, aktif, cocok dengan cakupan), kompetisi milik event, undangan ganda,
 * dan penugasan ganda (kontrak 13 bagian 3 "Aturan bisnis").
 */
function validateInvitation(
  eventUuid: string,
  competitionUuid: string | null,
  email: string,
  roleCode: string,
) {
  const errors: Record<string, string[]> = {};
  const add = (field: string, message: string) =>
    (errors[field] = [...(errors[field] ?? []), message]);

  if (!email) add("email", "The email field is required.");
  else if (!/^\S+@\S+\.\S+$/.test(email))
    add("email", "The email must be a valid email address.");

  const role = staffStore.roles.find((r) => r.code === roleCode);
  if (!roleCode)
    add("assignment_role", "The assignment role field is required.");
  else if (!role || !role.is_active)
    add("assignment_role", "The selected assignment role is invalid.");
  else {
    const needed: AssignmentRoleScope = competitionUuid
      ? "COMPETITION"
      : "EVENT";
    if (role.scope !== needed)
      add(
        "assignment_role",
        needed === "EVENT"
          ? "This role cannot be assigned to an event team."
          : "This role cannot be assigned to a competition.",
      );
  }

  if (competitionUuid) {
    const competition = store.competitions.find(
      (c) => c.uuid === competitionUuid,
    );
    if (!competition || competition.event_uuid !== eventUuid)
      add(
        "competition_id",
        "The selected competition does not belong to this event.",
      );
  }

  if (errors.email === undefined && role) {
    const sameTarget = (target: string | null) => target === competitionUuid;
    const pending = staffStore.invitations.some(
      (i) =>
        i.status === "PENDING" &&
        i.event_uuid === eventUuid &&
        sameTarget(i.competition_uuid) &&
        i.assignment_role === roleCode &&
        i.email.toLowerCase() === email.toLowerCase(),
    );
    if (pending)
      add("email", "An invitation for this email and role is already pending.");
    const existing = userByEmail(email);
    const holds =
      existing !== undefined &&
      staffStore.assignments.some(
        (a) =>
          a.status === "ACTIVE" &&
          a.event_uuid === eventUuid &&
          sameTarget(a.competition_uuid) &&
          a.assignment_role === roleCode &&
          a.user_uuid === existing.uuid,
      );
    if (holds) add("email", "This person already holds this role here.");
  }
  if (Object.keys(errors).length) invalid(errors);
}

/**
 * `POST /staff-invitations`. Dipakai juga oleh wizard New event (PIC = EVENT_MANAGER).
 * Butuh `staff.invite` dan hak mengelola event itu (403), lalu aturan data (422).
 * Undangan baru tersimpan PENDING; menerima undangan bukan bagian layar ini.
 */
export function createInvitationRecord(
  user: MockUser,
  body: Record<string, unknown> | undefined,
  now = new Date(),
): ApiStaffInvitation {
  const eventUuid = String(body?.event_id ?? "");
  if (!eventUuid) invalid({ event_id: ["The event id field is required."] });
  if (!store.events.some((e) => e.uuid === eventUuid))
    invalid({ event_id: ["The selected event id is invalid."] });

  const caller = callerFor(user, eventUuid);
  forbidUnless(
    caller.managesEvent && hasPermission(caller, PERMISSION.STAFF_INVITE),
  );

  const competitionUuid = body?.competition_id
    ? String(body.competition_id)
    : null;
  const email = String(body?.email ?? "").trim();
  const roleCode = String(body?.assignment_role ?? "");
  validateInvitation(eventUuid, competitionUuid, email, roleCode);

  const invitation: MockStaffInvitation = {
    uuid: nextUuid(),
    event_uuid: eventUuid,
    competition_uuid: competitionUuid,
    email,
    assignment_role: roleCode,
    status: "PENDING",
    expires_at: iso(new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS)),
  };
  staffStore.invitations.push(invitation);
  return invitationRecord(invitation, caller);
}

/** `DELETE /staff-invitations/{uuid}`: mencabut undangan PENDING. Butuh `actions.revoke`. */
export function revokeInvitationRecord(user: MockUser, uuid: string): null {
  const invitation = findOrThrow(staffStore.invitations, uuid, "Invitation");
  const caller = callerFor(user, invitation.event_uuid);
  forbidUnless(staffActions(caller).revoke);
  if (invitation.status !== "PENDING")
    throw new ApiError(422, "Only a pending invitation can be revoked.");
  invitation.status = "REVOKED";
  return null;
}

/** `DELETE /staff-assignments/{uuid}`: mencabut penugasan aktif. Butuh `actions.revoke`. */
export function revokeAssignmentRecord(user: MockUser, uuid: string): null {
  const assignment = findOrThrow(staffStore.assignments, uuid, "Assignment");
  const caller = callerFor(user, assignment.event_uuid);
  forbidUnless(staffActions(caller).revoke);
  if (assignment.status !== "ACTIVE")
    throw new ApiError(422, "Only an active assignment can be revoked.");
  assignment.status = "REVOKED";
  return null;
}
