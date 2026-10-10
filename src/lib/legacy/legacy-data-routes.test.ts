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
    expect(needsLegacyData("/event-management/7f3a-uuid")).toBe(false);
    expect(needsLegacyData("/event-management/7f3a-uuid/competitions")).toBe(
      false,
    );
    expect(
      needsLegacyData("/event-management/7f3a-uuid/competitions/create"),
    ).toBe(false);
  });
  it("still loads for old pages that read the shared store", () => {
    expect(needsLegacyData("/event-management/create")).toBe(true);
    expect(needsLegacyData("/event-management/event-registration")).toBe(true);
    expect(needsLegacyData("/event-management/7f3a-uuid/competitions/c1")).toBe(
      true,
    );
    expect(needsLegacyData("/event-management/7f3a-uuid/edit")).toBe(true);
    expect(needsLegacyData("/user-management")).toBe(true);
    expect(needsLegacyData("/competition")).toBe(true);
  });
});
