import { describe, expect, it } from "vitest";
import { needsLegacyData } from "./legacy-data-routes";

describe("needsLegacyData", () => {
  it("skips the migrated events list and event overview", () => {
    expect(needsLegacyData("/home")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/registrations")).toBe(
      false,
    );
    expect(needsLegacyData("/event-management/7f3a-uuid/participants")).toBe(
      false,
    );
    expect(needsLegacyData("/event-management")).toBe(false);
    expect(needsLegacyData("/event-management/create")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/edit")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/committee")).toBe(
      false,
    );
    expect(needsLegacyData("/event-management/7f3a-uuid/sponsors")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/doorprize")).toBe(
      false,
    );
    expect(needsLegacyData("/event-management/7f3a-uuid")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/competitions")).toBe(
      false,
    );
    expect(
      needsLegacyData("/event-management/7f3a-uuid/competitions/create"),
    ).toBe(false);
  });
  it("skips the migrated Brands pages", () => {
    expect(needsLegacyData("/sponsorship-brand")).toBe(false);
    expect(needsLegacyData("/sponsorship-brand/create")).toBe(false);
    expect(needsLegacyData("/sponsorship-brand/b1")).toBe(false);
    expect(needsLegacyData("/sponsorship-brand/b1/edit")).toBe(false);
    expect(needsLegacyData("/sponsorship-brand/b1/other/deep")).toBe(true);
  });
  it("skips the migrated Pets pages", () => {
    expect(needsLegacyData("/pet-management")).toBe(false);
    expect(needsLegacyData("/pet-management/create")).toBe(false);
    expect(needsLegacyData("/pet-management/p1")).toBe(false);
    expect(needsLegacyData("/pet-management/p1/edit")).toBe(false);
    expect(needsLegacyData("/pet-management/p1/other/deep")).toBe(true);
  });
  it("skips the migrated Competition workspace pages", () => {
    const base = "/event-management/7f3a-uuid/competitions/c1";
    expect(needsLegacyData(base)).toBe(false);
    for (const tab of [
      "edit",
      "participants",
      "committee",
      "settings",
      "results",
    ])
      expect(needsLegacyData(`${base}/${tab}`)).toBe(false);
    expect(needsLegacyData(`${base}/other/deep`)).toBe(true);
  });
  it("still loads for old pages that read the shared store", () => {
    expect(needsLegacyData("/event-management/doorprize-drawing")).toBe(true);
    expect(needsLegacyData("/my-competitions")).toBe(true);
  });
  it("skips the migrated Reports pages", () => {
    expect(needsLegacyData("/report")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/reports")).toBe(false);
  });
  it("skips the migrated Users and Roles pages", () => {
    expect(needsLegacyData("/user-management")).toBe(false);
    expect(needsLegacyData("/user-management/create")).toBe(false);
    expect(needsLegacyData("/user-management/u1")).toBe(false);
    expect(needsLegacyData("/user-management/u1/edit")).toBe(false);
    expect(needsLegacyData("/user-management/u1/other/deep")).toBe(true);
    expect(needsLegacyData("/roles-access")).toBe(false);
  });
  it("skips the migrated Organizations pages", () => {
    expect(needsLegacyData("/organization-management")).toBe(false);
    expect(needsLegacyData("/organization-management/o1")).toBe(false);
    expect(needsLegacyData("/organization-management/o1/events")).toBe(false);
    expect(needsLegacyData("/organization-management/o1/invitations")).toBe(
      false,
    );
    expect(needsLegacyData("/organization-management/o1/profile")).toBe(false);
    expect(needsLegacyData("/organization-management/o1/other/deep")).toBe(
      true,
    );
  });
});
