import { describe, expect, it } from "vitest";
import {
  EMPTY_MEMBER_FILTERS,
  filterMembers,
  findMemberByEmail,
  hasMemberFilters,
  pageOf,
} from "./members";
import type { OrganizationMember } from "./types";

const m = (
  name: string,
  email: string | null,
  role: string,
): OrganizationMember => ({ id: name, userId: name, name, email, role });

const MEMBERS = [
  m("Salsa Putri", "salsa.putri@example.com", "OWNER"),
  m("Rani Kusuma", "rani.kusuma@example.com", "ADMIN"),
  m("Nadia Safitri", null, "STAFF"),
  m("Farhan Akbar", "farhan.akbar@example.com", "STAFF"),
];

describe("filterMembers", () => {
  it("returns everyone without filters", () => {
    expect(filterMembers(MEMBERS, EMPTY_MEMBER_FILTERS)).toHaveLength(4);
  });
  it("matches name ignoring case", () => {
    const rows = filterMembers(MEMBERS, {
      ...EMPTY_MEMBER_FILTERS,
      name: " SA",
    });
    expect(rows.map((r) => r.name)).toEqual(["Salsa Putri", "Nadia Safitri"]);
  });
  it("matches email, skipping members without an email", () => {
    const rows = filterMembers(MEMBERS, {
      ...EMPTY_MEMBER_FILTERS,
      email: "example",
    });
    expect(rows).toHaveLength(3);
  });
  it("combines name and role", () => {
    const rows = filterMembers(MEMBERS, {
      name: "a",
      email: "",
      role: "STAFF",
    });
    expect(rows.map((r) => r.name)).toEqual(["Nadia Safitri", "Farhan Akbar"]);
  });
  it("tells whether a filter is active", () => {
    expect(hasMemberFilters(EMPTY_MEMBER_FILTERS)).toBe(false);
    expect(hasMemberFilters({ ...EMPTY_MEMBER_FILTERS, name: "  " })).toBe(
      false,
    );
    expect(hasMemberFilters({ ...EMPTY_MEMBER_FILTERS, role: "OWNER" })).toBe(
      true,
    );
  });
});

describe("pageOf", () => {
  const items = [1, 2, 3, 4, 5];
  it("slices a page", () => {
    expect(pageOf(items, 1, 2)).toEqual([1, 2]);
    expect(pageOf(items, 3, 2)).toEqual([5]);
  });
  it("clamps an out-of-range page", () => {
    expect(pageOf(items, 9, 2)).toEqual([5]);
    expect(pageOf(items, 0, 2)).toEqual([1, 2]);
    expect(pageOf([], 1, 10)).toEqual([]);
  });
});

describe("findMemberByEmail", () => {
  it("matches ignoring case and spaces", () => {
    expect(findMemberByEmail(MEMBERS, " RANI.KUSUMA@example.com ")?.name).toBe(
      "Rani Kusuma",
    );
  });
  it("returns undefined for no match or empty input", () => {
    expect(findMemberByEmail(MEMBERS, "nobody@example.com")).toBeUndefined();
    expect(findMemberByEmail(MEMBERS, "")).toBeUndefined();
  });
});
