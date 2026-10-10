import { describe, expect, it } from "vitest";
import {
  eventListParams,
  eventPageFromApi,
  eventPhaseLabel,
  fromApi,
  type ApiEvent,
} from "./types";

const row: ApiEvent = {
  uuid: "e1",
  organization_uuid: "o1",
  name: "Paw Race",
  slug: "paw-race",
  tagline: null,
  description: null,
  venue_name: "Grand City",
  venue_address: null,
  map_location: null,
  timezone: "Asia/Jakarta",
  start_at: "2026-09-04T10:00:00Z",
  end_at: "2026-09-04T20:00:00Z",
  status: "PUBLISHED",
};

describe("fromApi", () => {
  it("maps the API fields to the screen shape", () => {
    expect(fromApi(row)).toMatchObject({
      id: "e1",
      organizationId: "o1",
      name: "Paw Race",
      venueName: "Grand City",
      status: "PUBLISHED",
    });
  });
  it("turns null optional fields into empty strings", () => {
    expect(fromApi(row).tagline).toBe("");
    expect(fromApi(row).venueAddress).toBe("");
  });
  it("keeps the contract fields when the backend sends them", () => {
    const event = fromApi({
      ...row,
      code: "EVT-2026-0002",
      organization_name: "East Java Pet Sport",
      phase: "EVENT_DAY",
    });
    expect(event).toMatchObject({
      code: "EVT-2026-0002",
      organizationName: "East Java Pet Sport",
      phase: "EVENT_DAY",
    });
  });
  it("leaves them empty when the real backend does not send them yet", () => {
    expect(fromApi(row)).toMatchObject({
      code: "",
      organizationName: "",
      phase: null,
    });
  });
});

describe("eventPhaseLabel", () => {
  it("uses the phase from the backend", () => {
    expect(eventPhaseLabel({ phase: "EVENT_DAY", status: "PUBLISHED" })).toBe(
      "Event day",
    );
  });
  it("falls back to the status in title case", () => {
    expect(eventPhaseLabel({ phase: null, status: "PUBLISHED" })).toBe(
      "Published",
    );
    expect(eventPhaseLabel({ phase: null, status: "DRAFT" })).toBe("Draft");
  });
});

describe("eventListParams", () => {
  it("renames the screen filters to API query names and trims text", () => {
    expect(
      eventListParams({
        phase: "UPCOMING",
        q: "  paw ",
        organizationId: "o1",
        month: "2026-09",
        sort: "name",
        direction: "asc",
        page: 2,
        perPage: 8,
      }),
    ).toEqual({
      phase: "UPCOMING",
      q: "paw",
      name: undefined,
      venue: undefined,
      month: "2026-09",
      organization_id: "o1",
      sort: "name",
      direction: "asc",
      page: 2,
      per_page: 8,
    });
  });
});

describe("eventPageFromApi", () => {
  const meta = { current_page: 1, per_page: 8, total: 35, last_page: 5 };
  it("maps the page, the meta and the tab counts", () => {
    const page = eventPageFromApi({
      items: [row],
      meta,
      summary: { all: 35, event_day: 1, upcoming: 2, draft: 3, finished: 29 },
    });
    expect(page.items).toHaveLength(1);
    expect(page.meta.total).toBe(35);
    expect(page.summary).toEqual({
      all: 35,
      eventDay: 1,
      upcoming: 2,
      draft: 3,
      finished: 29,
    });
  });
  it("has no summary when the backend does not send one", () => {
    expect(eventPageFromApi({ items: [], meta }).summary).toBeNull();
  });
});
