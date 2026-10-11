import { SUPERADMIN_EMAILS, store } from "./mock-store";
import type { MockUser } from "./mock-types";
import { PERMISSION as P } from "@/lib/auth/permissions";
import { findMockRole, permissionsOfRoles } from "./mock-roles";

/**
 * Mock of what `GET /auth/me` returns for roles, permissions, and org membership.
 * Permission per role berasal dari `mock-roles.ts` (salinan `role_permissions.json`).
 */

/**
 * Role platform user. Bila role pernah diatur (`user.roles`, lewat form New user atau
 * assign/revoke) itulah yang dipakai. Kalau belum, diturunkan: super admin dari
 * `SUPERADMIN_EMAILS`, ORGANIZER untuk anggota organisasi, selain itu USER.
 * Dipanggil dari `mockAccess` dan `mock-users.ts`.
 */
export function roleCodesOf(user: MockUser): string[] {
  if (user.roles) return [...user.roles];
  if (SUPERADMIN_EMAILS.includes(user.email.toLowerCase()))
    return ["SUPER_ADMIN"];
  const isMember = store.organizations.some((org) =>
    org.pics.some((pic) => pic.user_uuid === user.uuid),
  );
  return isMember ? ["USER", "ORGANIZER"] : ["USER"];
}

export function mockAccess(user: MockUser) {
  const orgs = store.organizations.filter((org) =>
    org.pics.some((pic) => pic.user_uuid === user.uuid),
  );
  const roles = roleCodesOf(user);
  const permissions: string[] = roles.includes("SUPER_ADMIN")
    ? Object.values(P)
    : permissionsOfRoles(roles);
  // Backend asli hanya memberi staff.manage ke OWNER organisasi. Mock tidak punya role OWNER
  // (semua anggota organisasi ADMIN), jadi organizer demo diberi izin ini supaya Remove bisa dicoba.
  if (roles.includes("ORGANIZER") && !permissions.includes(P.STAFF_MANAGE))
    permissions.push(P.STAFF_MANAGE);
  return {
    roles: roles.flatMap((code) => {
      const role = findMockRole(code);
      return role ? [{ uuid: role.uuid, code, name: role.name }] : [];
    }),
    permissions,
    // Same shape as the real GET /auth/me (petpet-service UserData).
    organizations: orgs.map((org) => ({
      uuid: org.uuid,
      name: org.name,
      // Peran dari keanggotaan; data lama tanpa peran dibaca sebagai ADMIN.
      member_role:
        org.pics.find((pic) => pic.user_uuid === user.uuid)?.member_role ??
        ("ADMIN" as const),
      status: "ACTIVE",
    })),
    staff_assignments: [] as {
      uuid: string;
      event_uuid: string;
      competition_uuid: string | null;
      assignment_role: string;
      status: string;
    }[],
  };
}
