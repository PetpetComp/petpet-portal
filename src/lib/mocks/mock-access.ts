import { SUPERADMIN_EMAILS, store } from "./mock-store";
import type { MockUser } from "./mock-types";
import { PERMISSION as P } from "@/lib/auth/permissions";

/**
 * Mock of what `GET /auth/me` returns for roles, permissions, and org membership.
 * The permission lists mirror petpet-service `role_permissions.json`.
 */
const USER = [
  P.EVENT_VIEW,
  P.COMPETITION_VIEW,
  P.REGISTRATION_VIEW,
  P.PAYMENT_VIEW,
];
const ORGANIZER = [
  ...USER,
  P.ORGANIZATION_VIEW,
  P.EVENT_CREATE,
  P.EVENT_UPDATE,
  P.EVENT_PUBLISH,
  P.COMPETITION_CREATE,
  P.COMPETITION_UPDATE,
  P.COMPETITION_DELETE,
  P.REGISTRATION_APPROVE,
  P.REGISTRATION_REJECT,
  P.PAYMENT_VERIFY,
  P.SCORING_VIEW,
  P.SCORING_INPUT,
  P.SCORING_VERIFY,
  P.STAFF_INVITE,
];

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORGANIZER: "Organizer",
  USER: "User",
};

export function mockAccess(user: MockUser) {
  const orgs = store.organizations.filter((org) =>
    org.pics.some((pic) => pic.user_uuid === user.uuid),
  );
  const roles = SUPERADMIN_EMAILS.includes(user.email.toLowerCase())
    ? ["SUPER_ADMIN"]
    : orgs.length
      ? ["USER", "ORGANIZER"]
      : ["USER"];
  const permissions = roles.includes("SUPER_ADMIN")
    ? Object.values(P)
    : [...new Set(roles.includes("ORGANIZER") ? ORGANIZER : USER)];
  return {
    roles: roles.map((code) => ({ code, name: ROLE_NAMES[code] })),
    permissions,
    organization_memberships: orgs.map((org) => ({
      member_role: "ADMIN",
      status: "ACTIVE",
      organization: { uuid: org.uuid },
    })),
    staff_assignments: [],
  };
}
