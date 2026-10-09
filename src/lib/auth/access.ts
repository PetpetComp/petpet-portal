import type { Permission } from "./permissions";

/**
 * What the portal knows about the signed-in user's access, taken from `/auth/me`.
 * Three layers (see docs/08 §9.6): platform permissions, organization role,
 * and per-event assignments. These helpers only decide what to SHOW;
 * the backend remains the real gate.
 */
export interface AccessProfile {
  roles: string[];
  permissions: string[];
  memberships: { organizationId: string; role: string }[];
  assignments: {
    eventId: string;
    competitionId: string | null;
    role: string;
  }[];
}

export const NO_ACCESS: AccessProfile = {
  roles: [],
  permissions: [],
  memberships: [],
  assignments: [],
};

const isSuperAdmin = (a: AccessProfile) => a.roles.includes("SUPER_ADMIN");

/** Platform-wide: does the user hold this permission at all? */
export function can(access: AccessProfile, permission: Permission): boolean {
  return isSuperAdmin(access) || access.permissions.includes(permission);
}

/**
 * On one event: needs the permission AND a relationship to that event,
 * either OWNER/ADMIN of its organization or an assignment on it.
 */
export function canOnEvent(
  access: AccessProfile,
  event: { id: string; organizationId: string },
  permission: Permission,
): boolean {
  if (isSuperAdmin(access)) return true;
  if (!can(access, permission)) return false;
  const orgManager = access.memberships.some(
    (m) =>
      m.organizationId === event.organizationId &&
      (m.role === "OWNER" || m.role === "ADMIN"),
  );
  const assigned = access.assignments.some((a) => a.eventId === event.id);
  return orgManager || assigned;
}
