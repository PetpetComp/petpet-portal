import { describe, expect, it } from "vitest";
import { fromApi } from "./types";

describe("fromApi", () => {
  it("maps snake_case API fields", () => {
    expect(
      fromApi({
        uuid: "e1",
        organization_uuid: "o1",
        name: "Paw Race",
        venue_name: "Grand City",
        start_at: "2026-09-04T10:00:00Z",
        end_at: "2026-09-04T20:00:00Z",
        status: "PUBLISHED",
      }),
    ).toMatchObject({
      id: "e1",
      organizationId: "o1",
      name: "Paw Race",
      venueName: "Grand City",
      status: "PUBLISHED",
    });
  });
  it("turns missing optional fields into empty strings", () => {
    expect(fromApi({ uuid: "e1", tagline: null }).tagline).toBe("");
  });
});
