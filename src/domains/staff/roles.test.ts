import { describe, expect, it } from "vitest";
import {
  defaultRoleFor,
  roleLabel,
  rolesForScope,
  scopeOfTarget,
  sortRoles,
} from "./roles";
import { FALLBACK_ASSIGNMENT_ROLES, roleFromApi } from "./types";

const roles = FALLBACK_ASSIGNMENT_ROLES.map(roleFromApi);

describe("rolesForScope", () => {
  it("offers only the event role for the event team", () => {
    expect(rolesForScope(roles, "EVENT").map((r) => r.code)).toEqual([
      "EVENT_MANAGER",
    ]);
  });
  it("offers the competition roles for a competition, ordered by sortOrder", () => {
    expect(rolesForScope(roles, "COMPETITION").map((r) => r.code)).toEqual([
      "COMPETITION_PIC",
      "JUDGE",
      "HEAD_JUDGE",
      "TIMER_OPERATOR",
      "MARSHAL",
    ]);
  });
  it("drops inactive roles from the form", () => {
    const withInactive = roles.map((r) =>
      r.code === "MARSHAL" ? { ...r, isActive: false } : r,
    );
    expect(
      rolesForScope(withInactive, "COMPETITION").map((r) => r.code),
    ).not.toContain("MARSHAL");
  });
});

describe("roleLabel", () => {
  it("uses the label from the list", () => {
    expect(roleLabel(roles, "HEAD_JUDGE")).toBe("Head judge");
  });
  it("shows an unknown code as it is", () => {
    expect(roleLabel(roles, "PHOTOGRAPHER")).toBe("PHOTOGRAPHER");
  });
  it("keeps the label of an inactive role so old assignments stay readable", () => {
    const withInactive = roles.map((r) =>
      r.code === "JUDGE" ? { ...r, isActive: false } : r,
    );
    expect(roleLabel(withInactive, "JUDGE")).toBe("Judge");
  });
});

describe("sortRoles and scopeOfTarget", () => {
  it("sorts by sortOrder then code without changing the input", () => {
    const input = [
      { ...roles[0], code: "B", sortOrder: 1 },
      { ...roles[0], code: "A", sortOrder: 1 },
      { ...roles[0], code: "C", sortOrder: 0 },
    ];
    expect(sortRoles(input).map((r) => r.code)).toEqual(["C", "A", "B"]);
    expect(input.map((r) => r.code)).toEqual(["B", "A", "C"]);
  });
  it("maps targets to scopes", () => {
    expect(scopeOfTarget({ kind: "event" })).toBe("EVENT");
    expect(scopeOfTarget({ kind: "competition", competitionId: "c1" })).toBe(
      "COMPETITION",
    );
  });
});

describe("defaultRoleFor", () => {
  it("preselects the only role of the event scope", () => {
    expect(defaultRoleFor(roles, "EVENT")).toBe("EVENT_MANAGER");
  });
  it("leaves the choice open when several roles fit", () => {
    expect(defaultRoleFor(roles, "COMPETITION")).toBe("");
  });
});
