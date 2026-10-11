import { describe, expect, it } from "vitest";
import { navigation, visibleNavigation } from "./nav-data";

const labels = (allowed: string[]) =>
  visibleNavigation(navigation, (p) => allowed.includes(p)).map((g) => g.label);

describe("visibleNavigation", () => {
  it("shows a user without permissions only what needs none", () => {
    expect(labels([])).toEqual(["Home", "Pets", "Organizations"]);
  });
  it("shows My assignments only to users with a staff assignment", () => {
    const names = (hasAssignments: boolean) =>
      visibleNavigation(navigation, () => false, hasAssignments).map(
        (g) => g.label,
      );
    expect(names(false)).not.toContain("My assignments");
    expect(names(true)).toEqual([
      "Home",
      "My assignments",
      "Pets",
      "Organizations",
    ]);
  });
  it("shows organizer menus once the permission is held", () => {
    expect(labels(["event.update"])).toEqual(
      expect.arrayContaining(["Events", "Reports", "Event tools"]),
    );
  });
  it("hides platform-admin menus from organizers", () => {
    const organizer = labels(["event.update", "organization.view"]);
    expect(organizer).not.toContain("Users");
    // Organizations terbuka untuk semua akun (tombol "Apply as organizer").
    expect(organizer).toContain("Organizations");
    expect(organizer).not.toContain("Brands");
  });
  it("hides the Event tools group when none of its items are allowed", () => {
    expect(labels(["user.view"])).not.toContain("Event tools");
  });
  it("lists the sections in design order", () => {
    const sections = visibleNavigation(navigation, () => true).map(
      (g) => g.section,
    );
    expect([...new Set(sections)]).toEqual([
      "Main",
      "Data",
      "Insight",
      "Transitional",
    ]);
  });
});
