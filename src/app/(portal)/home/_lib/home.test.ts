import { describe, expect, it } from "vitest";
import { daysUntilLabel, homeAudience } from "./home";

describe("homeAudience", () => {
  it("waits while the access profile is loading", () => {
    expect(
      homeAudience({ loading: true, isManager: false, assignmentCount: 2 }),
    ).toBe("loading");
  });
  it("keeps managers on Home even when they also have assignments", () => {
    expect(
      homeAudience({ loading: false, isManager: true, assignmentCount: 3 }),
    ).toBe("organizer");
  });
  it("sends users with only assignments to My assignments", () => {
    expect(
      homeAudience({ loading: false, isManager: false, assignmentCount: 1 }),
    ).toBe("staff");
  });
  it("tells apart users without any role", () => {
    expect(
      homeAudience({ loading: false, isManager: false, assignmentCount: 0 }),
    ).toBe("none");
  });
});

describe("daysUntilLabel", () => {
  const now = new Date(2026, 8, 4, 15, 0);
  it("counts calendar days, not 24-hour blocks", () => {
    expect(daysUntilLabel(new Date(2026, 8, 5, 7, 0).toISOString(), now)).toBe(
      "tomorrow",
    );
    expect(daysUntilLabel(new Date(2026, 8, 7, 7, 0).toISOString(), now)).toBe(
      "in 3 days",
    );
  });
  it("returns an empty text for an invalid date", () => {
    expect(daysUntilLabel("nope", now)).toBe("");
  });
});
