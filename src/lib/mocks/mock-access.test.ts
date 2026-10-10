import { describe, expect, it } from "vitest";
import { mockAccess } from "./mock-access";
import { SUPERADMIN_EMAILS, store } from "./mock-store";

const base = { password: "", first_name: "A", status: "ACTIVE" };

describe("mockAccess", () => {
  it("gives a plain user view-only permissions", () => {
    const a = mockAccess({
      ...base,
      uuid: "none",
      username: "u",
      email: "u@x.dev",
    });
    expect(a.roles.map((r) => r.code)).toEqual(["USER"]);
    expect(a.permissions).not.toContain("event.update");
  });
  it("gives super admin every permission", () => {
    const email = SUPERADMIN_EMAILS[0];
    const a = mockAccess({ ...base, uuid: "sa", username: "sa", email });
    expect(a.roles.map((r) => r.code)).toEqual(["SUPER_ADMIN"]);
    expect(a.permissions).toContain("platform.settings");
  });
  it("makes members of an organization organizers", () => {
    const org = store.organizations.find((o) => o.pics.length);
    expect(org).toBeDefined();
    const pic = org!.pics[0];
    const a = mockAccess({
      ...base,
      uuid: pic.user_uuid,
      username: "p",
      email: "p@x.dev",
    });
    expect(a.roles.map((r) => r.code)).toContain("ORGANIZER");
    expect(a.organizations[0].uuid).toBe(org!.uuid);
  });
});
