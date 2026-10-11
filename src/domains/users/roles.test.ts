import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  filterPermissionGroups,
  hasGrantData,
  permissionCount,
  roleHasPermission,
  roleShortLabel,
  sortPermissionGroups,
  sortRoles,
} from "./roles";
import type { PermissionGroup, Role } from "./types";

const role = (code: string, permissions: string[] | null = null): Role => ({
  id: code,
  code,
  name: code.replace("_", " "),
  description: "",
  permissions,
  usersCount: null,
});

const perm = (code: string) => ({
  code,
  name: `Name ${code}`,
  description: "",
});

describe("sortRoles", () => {
  it("follows the design order and puts unknown roles last", () => {
    const sorted = sortRoles([
      role("USER"),
      role("ZZ_NEW"),
      role("JUDGE"),
      role("SUPER_ADMIN"),
      role("ORGANIZER"),
      role("EVENT_PIC"),
      role("ORGANIZATION_OWNER"),
    ]);
    expect(sorted.map((r) => r.code)).toEqual([
      "SUPER_ADMIN",
      "ORGANIZATION_OWNER",
      "ORGANIZER",
      "EVENT_PIC",
      "JUDGE",
      "USER",
      "ZZ_NEW",
    ]);
  });

  it("does not change the array it was given", () => {
    const input = [role("USER"), role("SUPER_ADMIN")];
    sortRoles(input);
    expect(input[0].code).toBe("USER");
  });
});

describe("roleShortLabel", () => {
  it("uses the short labels of the design and the upper-cased name otherwise", () => {
    expect(roleShortLabel(role("SUPER_ADMIN"))).toBe("SUPER");
    expect(roleShortLabel(role("ORGANIZATION_OWNER"))).toBe("OWNER");
    expect(roleShortLabel({ code: "NEW", name: "Auditor" })).toBe("AUDITOR");
  });
});

describe("grants", () => {
  it("tells apart granted, not granted and unknown", () => {
    const user = role("USER", ["event.view"]);
    expect(roleHasPermission(user, "event.view")).toBe(true);
    expect(roleHasPermission(user, "event.create")).toBe(false);
    expect(roleHasPermission(role("USER"), "event.view")).toBeNull();
  });

  it("counts permissions, or null when unknown", () => {
    expect(permissionCount(role("USER", ["a", "b"]))).toBe(2);
    expect(permissionCount(role("USER"))).toBeNull();
  });

  it("knows whether any role carries grant data", () => {
    expect(hasGrantData([role("A"), role("B")])).toBe(false);
    expect(hasGrantData([role("A"), role("B", [])])).toBe(true);
  });
});

describe("permission groups", () => {
  const groups: PermissionGroup[] = [
    { module: "user", permissions: [perm("user.manage"), perm("user.view")] },
    {
      module: "event",
      permissions: [
        perm("event.update"),
        perm("event.view"),
        perm("event.create"),
      ],
    },
    { module: "audit", permissions: [perm("audit.view")] },
  ];

  it("sorts modules and actions like the design, unknown ones last", () => {
    const sorted = sortPermissionGroups(groups);
    expect(sorted.map((g) => g.module)).toEqual(["event", "user", "audit"]);
    expect(sorted[0].permissions.map((p) => p.code)).toEqual([
      "event.view",
      "event.create",
      "event.update",
    ]);
    expect(sorted[1].permissions.map((p) => p.code)).toEqual([
      "user.view",
      "user.manage",
    ]);
  });

  it("filters by code or name and by module, dropping empty modules", () => {
    expect(filterPermissionGroups(groups, "", "")).toHaveLength(3);
    expect(filterPermissionGroups(groups, "EVENT.VIEW", "")).toEqual([
      { module: "event", permissions: [perm("event.view")] },
    ]);
    expect(filterPermissionGroups(groups, "name user.m", "")[0].module).toBe(
      "user",
    );
    expect(filterPermissionGroups(groups, "", "audit")).toHaveLength(1);
    expect(filterPermissionGroups(groups, "event", "user")).toEqual([]);
  });
});

describe("assignableRoles", () => {
  it("hides SUPER_ADMIN from callers who are not super admins", () => {
    const all = [role("SUPER_ADMIN"), role("USER")];
    expect(assignableRoles(all, false).map((r) => r.code)).toEqual(["USER"]);
    expect(assignableRoles(all, true)).toHaveLength(2);
  });
});
