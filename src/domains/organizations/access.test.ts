import { describe, expect, it } from "vitest";
import type { AccessProfile } from "@/lib/auth/access";
import {
  canApplyAsOrganizer,
  canCancelApplication,
  canChangeMemberRole,
  canRemoveMember,
  canReviewApplications,
  isInvitationExpired,
  isLastOwner,
  organizationRights,
  roleChoicesFor,
} from "./access";
import type { OrganizationMember } from "./types";

const viewer = (
  role: string | null,
  extra: Partial<AccessProfile> = {},
): AccessProfile => ({
  roles: ["USER"],
  permissions: [],
  memberships: role ? [{ organizationId: "org1", role }] : [],
  assignments: [],
  ...extra,
});

const member = (id: string, role: string): OrganizationMember => ({
  id,
  userId: `u-${id}`,
  name: id,
  email: null,
  role,
});

const OWNER = member("owner", "OWNER");
const ADMIN = member("admin", "ADMIN");
const STAFF = member("staff", "STAFF");

describe("organizationRights", () => {
  it("lets a non-member see nothing restricted", () => {
    const r = organizationRights(viewer(null), "org1");
    expect(r.role).toBeNull();
    expect(r.canViewMembers).toBe(false);
    expect(r.canInvite).toBe(false);
    expect(r.canEditProfile).toBe(false);
    expect(r.canViewVerifications).toBe(false);
  });

  it("lets staff view members but not manage", () => {
    const r = organizationRights(viewer("STAFF"), "org1");
    expect(r.canViewMembers).toBe(true);
    expect(r.canViewVerifications).toBe(true);
    expect(r.canInvite).toBe(false);
    expect(r.canViewInvitations).toBe(false);
    expect(r.canEditProfile).toBe(false);
    expect(r.canRemoveMembers).toBe(false);
  });

  it("lets an admin manage but not change roles or submit verification", () => {
    const r = organizationRights(viewer("ADMIN"), "org1");
    expect(r.canInvite).toBe(true);
    expect(r.canViewInvitations).toBe(true);
    expect(r.canEditProfile).toBe(true);
    expect(r.canRemoveMembers).toBe(true);
    expect(r.canChangeRoles).toBe(false);
    expect(r.canSubmitVerification).toBe(false);
  });

  it("lets an owner do everything in their organization", () => {
    const r = organizationRights(viewer("OWNER"), "org1");
    expect(r.canChangeRoles).toBe(true);
    expect(r.canSubmitVerification).toBe(true);
  });

  it("ignores memberships of other organizations", () => {
    const r = organizationRights(viewer("OWNER"), "other");
    expect(r.role).toBeNull();
    expect(r.canInvite).toBe(false);
  });

  it("lets a super admin act without being a member", () => {
    const r = organizationRights(
      viewer(null, { roles: ["SUPER_ADMIN"] }),
      "org1",
    );
    expect(r.isSuperAdmin).toBe(true);
    expect(r.canViewMembers).toBe(true);
    expect(r.canChangeRoles).toBe(true);
    expect(r.canEditProfile).toBe(true);
  });
});

describe("member rules", () => {
  const members = [OWNER, ADMIN, STAFF];

  it("finds the last owner", () => {
    expect(isLastOwner(OWNER, members)).toBe(true);
    expect(isLastOwner(OWNER, [...members, member("o2", "OWNER")])).toBe(false);
    expect(isLastOwner(ADMIN, members)).toBe(false);
  });

  it("blocks changing the role of the last owner", () => {
    const owner = organizationRights(viewer("OWNER"), "org1");
    expect(canChangeMemberRole(owner, OWNER, members)).toBe(false);
    expect(canChangeMemberRole(owner, ADMIN, members)).toBe(true);
    const admin = organizationRights(viewer("ADMIN"), "org1");
    expect(canChangeMemberRole(admin, STAFF, members)).toBe(false);
  });

  it("stops an admin from removing an owner, and anyone from removing the last owner", () => {
    const twoOwners = [...members, member("o2", "OWNER")];
    const admin = organizationRights(viewer("ADMIN"), "org1");
    expect(canRemoveMember(admin, OWNER, twoOwners)).toBe(false);
    expect(canRemoveMember(admin, STAFF, members)).toBe(true);
    const owner = organizationRights(viewer("OWNER"), "org1");
    expect(canRemoveMember(owner, OWNER, members)).toBe(false);
    expect(canRemoveMember(owner, OWNER, twoOwners)).toBe(true);
    const staff = organizationRights(viewer("STAFF"), "org1");
    expect(canRemoveMember(staff, STAFF, members)).toBe(false);
  });

  it("lets a super admin remove an owner when another owner remains", () => {
    const sa = organizationRights(
      viewer(null, { roles: ["SUPER_ADMIN"] }),
      "org1",
    );
    const twoOwners = [...members, member("o2", "OWNER")];
    expect(canRemoveMember(sa, OWNER, twoOwners)).toBe(true);
  });
});

describe("applications", () => {
  it("lets only organization.verify holders review", () => {
    expect(canReviewApplications(viewer(null))).toBe(false);
    expect(
      canReviewApplications(
        viewer(null, { permissions: ["organization.verify"] }),
      ),
    ).toBe(true);
    expect(
      canReviewApplications(viewer(null, { roles: ["SUPER_ADMIN"] })),
    ).toBe(true);
  });

  it("allows applying only without an open application", () => {
    expect(canApplyAsOrganizer([])).toBe(true);
    expect(canApplyAsOrganizer([{ status: "REJECTED" }])).toBe(true);
    expect(canApplyAsOrganizer([{ status: "APPROVED" }])).toBe(true);
    expect(canApplyAsOrganizer([{ status: "SUBMITTED" }])).toBe(false);
    expect(canApplyAsOrganizer([{ status: "UNDER_REVIEW" }])).toBe(false);
  });

  it("allows cancelling only draft or submitted", () => {
    expect(canCancelApplication({ status: "SUBMITTED" })).toBe(true);
    expect(canCancelApplication({ status: "DRAFT" })).toBe(true);
    expect(canCancelApplication({ status: "UNDER_REVIEW" })).toBe(false);
    expect(canCancelApplication({ status: "APPROVED" })).toBe(false);
  });
});

describe("small helpers", () => {
  it("keeps an unknown role in the dropdown", () => {
    expect(roleChoicesFor("ADMIN")).toEqual(["OWNER", "ADMIN", "STAFF"]);
    expect(roleChoicesFor("VIEWER")).toEqual([
      "VIEWER",
      "OWNER",
      "ADMIN",
      "STAFF",
    ]);
  });

  it("detects expired invitations", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(
      isInvitationExpired({ expiresAt: "2026-10-09T00:00:00Z" }, now),
    ).toBe(true);
    expect(
      isInvitationExpired({ expiresAt: "2026-10-11T00:00:00Z" }, now),
    ).toBe(false);
    expect(isInvitationExpired({ expiresAt: "not a date" }, now)).toBe(false);
  });
});
