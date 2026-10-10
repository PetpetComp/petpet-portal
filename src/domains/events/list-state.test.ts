import { describe, expect, it } from "vitest";
import {
  EMPTY_COLUMN_FILTERS,
  INITIAL_LIST_STATE,
  buildEventListQuery,
  hasActiveFilters,
} from "./list-state";

const none = { search: "", name: "", venue: "" };

describe("buildEventListQuery", () => {
  it("sends only paging and sort when nothing is filtered", () => {
    expect(buildEventListQuery(INITIAL_LIST_STATE, none)).toEqual({
      phase: undefined,
      q: undefined,
      name: undefined,
      venue: undefined,
      month: undefined,
      organizationId: undefined,
      sort: "start_at",
      direction: "desc",
      page: 1,
      perPage: 8,
    });
  });
  it("sends the filters, using the debounced text", () => {
    const state = {
      ...INITIAL_LIST_STATE,
      page: 3,
      filters: {
        ...EMPTY_COLUMN_FILTERS,
        phase: "UPCOMING" as const,
        month: "2026-09",
        organizationId: "o1",
        name: "typing now",
        venue: "typing now",
      },
      search: "typing now",
    };
    const query = buildEventListQuery(state, {
      search: " paw ",
      name: "evt-1",
      venue: "solo",
    });
    expect(query).toMatchObject({
      phase: "UPCOMING",
      month: "2026-09",
      organizationId: "o1",
      q: "paw",
      name: "evt-1",
      venue: "solo",
      page: 3,
    });
  });
});

describe("hasActiveFilters", () => {
  it("is false for the initial state and true once something is set", () => {
    expect(hasActiveFilters(INITIAL_LIST_STATE)).toBe(false);
    expect(hasActiveFilters({ ...INITIAL_LIST_STATE, search: " x " })).toBe(
      true,
    );
    expect(
      hasActiveFilters({
        ...INITIAL_LIST_STATE,
        filters: { ...EMPTY_COLUMN_FILTERS, phase: "DRAFT" },
      }),
    ).toBe(true);
    expect(hasActiveFilters({ ...INITIAL_LIST_STATE, search: "   " })).toBe(
      false,
    );
  });
});
