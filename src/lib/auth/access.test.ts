import { describe, expect, it } from "vitest";
import { can, canOnEvent, NO_ACCESS, type AccessProfile } from "./access";
import { PERMISSION as P } from "./permissions";

const event = { id: "ev1", organizationId: "org1" };
const organizer: AccessProfile = {
  ...NO_ACCESS,
  roles: ["ORGANIZER"],
  permissions: [P.EVENT_VIEW, P.EVENT_UPDATE],
};

describe("can", () => {
  it("checks the permission list", () => {
    expect(can(organizer, P.EVENT_UPDATE)).toBe(true);
    expect(can(organizer, P.USER_MANAGE)).toBe(false);
  });
  it("lets super admin do anything", () => {
    expect(
      can({ ...NO_ACCESS, roles: ["SUPER_ADMIN"] }, P.PLATFORM_SETTINGS),
    ).toBe(true);
  });
  it("denies an anonymous user", () => {
    expect(can(NO_ACCESS, P.EVENT_VIEW)).toBe(false);
  });
});

describe("canOnEvent", () => {
  it("denies an organizer with no tie to the event, even with the permission", () => {
    expect(canOnEvent(organizer, event, P.EVENT_UPDATE)).toBe(false);
  });
  it("allows owner/admin of the event's organization", () => {
    const owner = {
      ...organizer,
      memberships: [{ organizationId: "org1", role: "ADMIN" }],
    };
    expect(canOnEvent(owner, event, P.EVENT_UPDATE)).toBe(true);
  });
  it("denies plain staff of the organization", () => {
    const staff = {
      ...organizer,
      memberships: [{ organizationId: "org1", role: "STAFF" }],
    };
    expect(canOnEvent(staff, event, P.EVENT_UPDATE)).toBe(false);
  });
  it("denies admin of a different organization", () => {
    const other = {
      ...organizer,
      memberships: [{ organizationId: "org2", role: "OWNER" }],
    };
    expect(canOnEvent(other, event, P.EVENT_UPDATE)).toBe(false);
  });
  it("allows someone assigned to the event", () => {
    const manager = {
      ...organizer,
      assignments: [
        { eventId: "ev1", competitionId: null, role: "EVENT_MANAGER" },
      ],
    };
    expect(canOnEvent(manager, event, P.EVENT_UPDATE)).toBe(true);
  });
  it("still needs the permission", () => {
    const manager = {
      ...NO_ACCESS,
      assignments: [
        { eventId: "ev1", competitionId: null, role: "EVENT_MANAGER" },
      ],
    };
    expect(canOnEvent(manager, event, P.EVENT_UPDATE)).toBe(false);
  });
});
