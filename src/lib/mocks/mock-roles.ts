import type {
  ApiPermission,
  ApiPermissionsByModule,
  ApiRole,
} from "@/domains/users/types";

/**
 * Data tetap (tidak berubah saat demo) untuk role dan permission di backend palsu.
 * Isinya disalin dari petpet-service: `roles.json`, `permissions.json`, dan
 * `role_permissions.json` (seeder). Dipakai oleh `mock-access.ts` (permission efektif user)
 * dan `mock-users.ts` (endpoint `/auth/roles`, `/auth/permissions`, `/users`).
 */

/** Satu role seed. `uuid` palsu tapi stabil. */
export type MockRole = {
  uuid: string;
  code: string;
  name: string;
  description: string;
};

/** Role aktif, urutan seperti `roles.json`. `/auth/roles` mengurutkannya menurut nama (seperti backend). */
export const MOCK_ROLES: MockRole[] = [
  {
    uuid: "role-super-admin",
    code: "SUPER_ADMIN",
    name: "Super Admin",
    description:
      "Full platform access. Manages master data, organizations, and platform settings.",
  },
  {
    uuid: "role-user",
    code: "USER",
    name: "User",
    description:
      "Default role for every registered account. Can browse events and register pets.",
  },
  {
    uuid: "role-organization-owner",
    code: "ORGANIZATION_OWNER",
    name: "Organization Owner",
    description:
      "Owns an organization, manages its members, subscription, and payout accounts.",
  },
  {
    uuid: "role-organizer",
    code: "ORGANIZER",
    name: "Organizer",
    description:
      "Runs events and competitions for an organization: schedules, registrations, scoring.",
  },
  {
    uuid: "role-event-pic",
    code: "EVENT_PIC",
    name: "Event PIC",
    description:
      "Runs one assigned event (EVENT_MANAGER assignment): competitions, registrations, check-in. Cannot create, publish or delete events.",
  },
  {
    uuid: "role-judge",
    code: "JUDGE",
    name: "Judge",
    description:
      "Scores the competitions they are assigned to (JUDGE / HEAD_JUDGE assignment).",
  },
];

/** [kode, nama, modul] dari `permissions.json`. */
const PERMISSION_ROWS: [string, string, string][] = [
  ["event.view", "View Events", "event"],
  ["event.create", "Create Event", "event"],
  ["event.update", "Update Event", "event"],
  ["event.delete", "Delete Event", "event"],
  ["event.publish", "Publish Event", "event"],
  ["competition.view", "View Competitions", "competition"],
  ["competition.create", "Create Competition", "competition"],
  ["competition.update", "Update Competition", "competition"],
  ["competition.delete", "Delete Competition", "competition"],
  ["registration.view", "View Registrations", "registration"],
  ["registration.approve", "Approve Registration", "registration"],
  ["registration.reject", "Reject Registration", "registration"],
  ["payment.view", "View Payments", "payment"],
  ["payment.verify", "Verify Payment", "payment"],
  ["payment.refund", "Refund Payment", "payment"],
  ["payout.view", "View Payouts", "payout"],
  ["payout.request", "Request Payout", "payout"],
  ["payout.approve", "Approve Payout", "payout"],
  ["scoring.view", "View Scores", "scoring"],
  ["scoring.input", "Input Scores", "scoring"],
  ["scoring.verify", "Verify Results", "scoring"],
  ["organization.view", "View Organization", "organization"],
  ["organization.manage", "Manage Organization", "organization"],
  ["organization.verify", "Verify Organization", "organization"],
  ["staff.invite", "Invite Staff", "staff"],
  ["staff.manage", "Manage Staff", "staff"],
  ["user.view", "View Users", "user"],
  ["user.manage", "Manage Users", "user"],
  ["master.manage", "Manage Master Data", "master"],
  ["platform.settings", "Manage Platform Settings", "platform"],
];

/** Semua kode permission, urutan seperti seeder. */
export const ALL_PERMISSION_CODES = PERMISSION_ROWS.map(([code]) => code);

/** Permission per role seperti `role_permissions.json`. "*" = semua permission. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  USER: ["event.view", "competition.view", "registration.view", "payment.view"],
  ORGANIZATION_OWNER: [
    "organization.view",
    "organization.manage",
    "staff.invite",
    "staff.manage",
    "payout.view",
    "payout.request",
    "event.view",
    "event.create",
    "event.update",
    "event.delete",
    "event.publish",
    "competition.view",
    "competition.create",
    "competition.update",
    "competition.delete",
    "registration.view",
    "registration.approve",
    "registration.reject",
    "payment.view",
    "payment.verify",
    "scoring.view",
    "scoring.input",
    "scoring.verify",
  ],
  ORGANIZER: [
    "organization.view",
    "event.view",
    "event.create",
    "event.update",
    "event.publish",
    "competition.view",
    "competition.create",
    "competition.update",
    "competition.delete",
    "registration.view",
    "registration.approve",
    "registration.reject",
    "payment.view",
    "payment.verify",
    "scoring.view",
    "scoring.input",
    "scoring.verify",
    "staff.invite",
  ],
  EVENT_PIC: [
    "event.view",
    "event.update",
    "competition.view",
    "competition.create",
    "competition.update",
    "competition.delete",
    "registration.view",
    "registration.approve",
    "registration.reject",
    "payment.view",
    "payment.verify",
    "scoring.view",
    "staff.invite",
  ],
  JUDGE: [
    "event.view",
    "competition.view",
    "registration.view",
    "scoring.view",
    "scoring.input",
    "scoring.verify",
  ],
};

/**
 * Kode permission yang dipegang satu role, "*" sudah diperluas jadi semua permission
 * (seperti `RolePermissionSeeder` yang memasang semuanya ke SUPER_ADMIN).
 * Role yang tidak dikenal tidak punya permission.
 */
export function permissionsOfRole(roleCode: string): string[] {
  const codes = ROLE_PERMISSIONS[roleCode] ?? [];
  return codes.includes("*") ? [...ALL_PERMISSION_CODES] : [...codes];
}

/** Gabungan permission dari beberapa role, tanpa duplikat. */
export function permissionsOfRoles(roleCodes: string[]): string[] {
  return [...new Set(roleCodes.flatMap(permissionsOfRole))];
}

/** Role menurut kode, atau undefined bila tidak ada. */
export function findMockRole(code: string): MockRole | undefined {
  return MOCK_ROLES.find((role) => role.code === code);
}

/**
 * Isi `data.items` untuk `GET /auth/roles`: bentuk `RoleData::toArray` (uuid, code, name,
 * description) diurutkan menurut nama seperti `activeOrdered()` backend. `permissions` dan
 * `users_count` TAMBAHAN kontrak (belum ada di backend asli); `usersCount` dihitung pemanggil.
 */
export function roleRecords(usersCount: (code: string) => number): ApiRole[] {
  return [...MOCK_ROLES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((role) => ({
      uuid: role.uuid,
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: permissionsOfRole(role.code),
      users_count: usersCount(role.code),
    }));
}

/**
 * Isi `data` untuk `GET /auth/permissions`: objek modul -> daftar permission, modul urut abjad
 * dan kode urut abjad di dalamnya (seperti `PermissionRepository::allGroupedByModule`).
 */
export function permissionRecords(): ApiPermissionsByModule {
  const grouped: ApiPermissionsByModule = {};
  const sorted = [...PERMISSION_ROWS].sort(
    (a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]),
  );
  for (const [code, name, module] of sorted) {
    const row: ApiPermission = { code, name, description: null };
    (grouped[module] ??= []).push(row);
  }
  return grouped;
}
