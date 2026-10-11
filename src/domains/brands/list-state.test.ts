import { describe, expect, it } from "vitest";
import {
  DEFAULT_PER_PAGE,
  INITIAL_LIST_STATE,
  buildBrandListQuery,
  hasActiveSearch,
} from "./list-state";

describe("buildBrandListQuery", () => {
  it("starts on page 1 with the design's page size and no search", () => {
    expect(buildBrandListQuery(INITIAL_LIST_STATE, "")).toEqual({
      q: undefined,
      page: 1,
      perPage: DEFAULT_PER_PAGE,
    });
    expect(DEFAULT_PER_PAGE).toBe(8);
  });

  it("uses the debounced search text, trimmed, not the raw state", () => {
    const state = { ...INITIAL_LIST_STATE, search: "typing now", page: 2 };
    expect(buildBrandListQuery(state, "  paw ")).toEqual({
      q: "paw",
      page: 2,
      perPage: 8,
    });
  });
});

describe("hasActiveSearch", () => {
  it("ignores blank text", () => {
    expect(hasActiveSearch({ ...INITIAL_LIST_STATE, search: "   " })).toBe(
      false,
    );
    expect(hasActiveSearch({ ...INITIAL_LIST_STATE, search: "paw" })).toBe(
      true,
    );
  });
});
