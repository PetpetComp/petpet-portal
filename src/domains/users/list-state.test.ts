import { describe, expect, it } from "vitest";
import {
  EMPTY_USER_FILTERS,
  INITIAL_USER_LIST_STATE,
  buildUserListQuery,
  hasActiveUserFilters,
  nextUserSort,
} from "./list-state";

const noText = { name: "", email: "", phone: "", city: "" };

describe("buildUserListQuery", () => {
  it("sends nothing but paging and sort for the initial state", () => {
    expect(buildUserListQuery(INITIAL_USER_LIST_STATE, noText)).toEqual({
      q: undefined,
      email: undefined,
      phone: undefined,
      city: undefined,
      role: undefined,
      status: undefined,
      sort: "name",
      direction: "asc",
      page: 1,
      perPage: 8,
    });
  });

  it("uses the debounced text, trimmed, and the select values as they are", () => {
    const state = {
      ...INITIAL_USER_LIST_STATE,
      filters: {
        ...EMPTY_USER_FILTERS,
        name: "still typing",
        role: "JUDGE",
        status: "ACTIVE" as const,
      },
      page: 3,
    };
    const query = buildUserListQuery(state, {
      name: " sal ",
      email: "a@",
      phone: "0812",
      city: "Sby",
    });
    expect(query).toMatchObject({
      q: "sal",
      email: "a@",
      phone: "0812",
      city: "Sby",
      role: "JUDGE",
      status: "ACTIVE",
      page: 3,
    });
  });
});

describe("hasActiveUserFilters", () => {
  it("is false for blanks and true when any filter has a value", () => {
    expect(hasActiveUserFilters(EMPTY_USER_FILTERS)).toBe(false);
    expect(hasActiveUserFilters({ ...EMPTY_USER_FILTERS, name: "  " })).toBe(
      false,
    );
    expect(hasActiveUserFilters({ ...EMPTY_USER_FILTERS, role: "USER" })).toBe(
      true,
    );
    expect(hasActiveUserFilters({ ...EMPTY_USER_FILTERS, city: "x" })).toBe(
      true,
    );
  });
});

describe("nextUserSort", () => {
  it("flips the direction of the same column and resets for a new one", () => {
    expect(nextUserSort({ sort: "name", direction: "asc" }, "name")).toEqual({
      sort: "name",
      direction: "desc",
    });
    expect(nextUserSort({ sort: "name", direction: "desc" }, "name")).toEqual({
      sort: "name",
      direction: "asc",
    });
    expect(nextUserSort({ sort: "name", direction: "desc" }, "email")).toEqual({
      sort: "email",
      direction: "asc",
    });
  });
});
