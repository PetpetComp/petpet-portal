import { describe, expect, it } from "vitest";
import { navigation, visibleNavigation } from "./nav-data";

const labels = (allowed: string[], isSponsor = false) =>
  visibleNavigation(navigation, {
    can: (p) => allowed.includes(p),
    isSponsor,
  }).map((g) => g.label);

describe("visibleNavigation", () => {
  it("shows a plain user only what needs no permission", () => {
    expect(labels([])).toEqual(["My Competitions", "Pets"]);
  });
  it("shows the Sponsor menu to sponsors only", () => {
    expect(labels([])).not.toContain("Sponsor");
    expect(labels([], true)).toContain("Sponsor");
  });
  it("shows organizer menus once the permission is held", () => {
    expect(labels(["event.update", "organization.view"])).toEqual(
      expect.arrayContaining([
        "Events",
        "My Organization",
        "Reports",
        "Event tools",
      ]),
    );
  });
  it("hides platform-admin menus from organizers", () => {
    const organizer = labels(["event.update", "organization.view"]);
    expect(organizer).not.toContain("Users");
    expect(organizer).not.toContain("Organizations");
    expect(organizer).not.toContain("Brands");
  });
  it("hides the Event tools group when none of its items are allowed", () => {
    expect(labels(["user.view"])).not.toContain("Event tools");
  });
  it("lists the sections in design order", () => {
    const sections = visibleNavigation(navigation, {
      can: () => true,
      isSponsor: true,
    }).map((g) => g.section);
    expect([...new Set(sections)]).toEqual([
      "Main",
      "Data",
      "Insight",
      "Transitional",
    ]);
  });
});
