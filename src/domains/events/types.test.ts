import { describe, expect, it } from "vitest";
import { fromApi, type ApiEvent } from "./types";

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
});
