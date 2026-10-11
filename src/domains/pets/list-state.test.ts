import { describe, expect, it } from "vitest";
import {
  INITIAL_LIST_STATE,
  buildPetListQuery,
  hasActiveFilters,
} from "./list-state";

describe("buildPetListQuery", () => {
  it("sends only paging and the default sort when nothing is filtered", () => {
    expect(buildPetListQuery(INITIAL_LIST_STATE, "")).toEqual({
      q: undefined,
      speciesId: undefined,
      sort: "name",
      direction: "asc",
      page: 1,
      perPage: 8,
    });
  });

  it("passes the debounced search and the chosen species", () => {
    const query = buildPetListQuery(
      { ...INITIAL_LIST_STATE, speciesId: "sp-1", page: 3, perPage: 16 },
      "  mochi ",
    );
    expect(query).toMatchObject({
      q: "mochi",
      speciesId: "sp-1",
      page: 3,
      perPage: 16,
    });
  });
});

describe("hasActiveFilters", () => {
  it("is true for a search or a species chip", () => {
    expect(hasActiveFilters(INITIAL_LIST_STATE)).toBe(false);
    expect(hasActiveFilters({ ...INITIAL_LIST_STATE, search: " " })).toBe(
      false,
    );
    expect(hasActiveFilters({ ...INITIAL_LIST_STATE, search: "a" })).toBe(true);
    expect(hasActiveFilters({ ...INITIAL_LIST_STATE, speciesId: "x" })).toBe(
      true,
    );
  });
});
