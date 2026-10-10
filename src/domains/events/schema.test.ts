import { describe, expect, it } from "vitest";
import {
  detailsFromEvent,
  detailsToApi,
  eventDetailsSchema,
  eventInitials,
  isEndAfterStart,
  serverErrorsToFormErrors,
  toDatetimeLocal,
  toIsoString,
  type EventDetailsValues,
} from "./schema";
import { fromApi, type ApiEvent } from "./types";

const valid: EventDetailsValues = {
  name: "  Surabaya Paw Race 2026 ",
  startAt: "2026-09-04T10:00",
  endAt: "2026-09-04T20:00",
  venueName: "",
  venueAddress: "",
  tagline: "",
};

describe("eventDetailsSchema", () => {
  it("accepts the minimum (name, start, end) and trims the name", () => {
    const result = eventDetailsSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Surabaya Paw Race 2026");
  });
  it("requires a name, a start and an end", () => {
    const result = eventDetailsSchema.safeParse({
      ...valid,
      name: "  ",
      startAt: "",
      endAt: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining(["name", "startAt", "endAt"]),
      );
    }
  });
  it("puts the 'end after start' error on the end field", () => {
    const result = eventDetailsSchema.safeParse({
      ...valid,
      endAt: "2026-09-04T09:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["endAt"]);
      expect(result.error.issues[0].message).toBe(
        "End must be after the start.",
      );
    }
  });
  it("limits the name to 200 and the slogan to 255 characters", () => {
    expect(
      eventDetailsSchema.safeParse({ ...valid, name: "a".repeat(201) }).success,
    ).toBe(false);
    expect(
      eventDetailsSchema.safeParse({ ...valid, tagline: "a".repeat(256) })
        .success,
    ).toBe(false);
  });
});

describe("isEndAfterStart", () => {
  it("compares datetime-local values", () => {
    expect(isEndAfterStart("2026-09-04T10:00", "2026-09-04T10:01")).toBe(true);
    expect(isEndAfterStart("2026-09-04T10:00", "2026-09-04T10:00")).toBe(false);
  });
});

describe("date conversion", () => {
  it("round-trips a datetime-local value through ISO", () => {
    expect(toDatetimeLocal(toIsoString("2026-09-04T10:00"))).toBe(
      "2026-09-04T10:00",
    );
  });
  it("returns an empty value for an invalid date", () => {
    expect(toDatetimeLocal("nope")).toBe("");
  });
});

describe("detailsToApi", () => {
  it("sends empty optional text as null so Edit can clear it", () => {
    const body = detailsToApi(eventDetailsSchema.parse(valid));
    expect(body).toMatchObject({
      name: "Surabaya Paw Race 2026",
      tagline: null,
      venue_name: null,
      venue_address: null,
    });
    expect(body.start_at).toBe(toIsoString("2026-09-04T10:00"));
    expect(body).not.toHaveProperty("timezone");
  });
});

describe("detailsFromEvent", () => {
  it("fills the Edit form from an event", () => {
    const api: ApiEvent = {
      uuid: "e1",
      organization_uuid: "o1",
      name: "Paw Race",
      slug: "paw-race",
      tagline: "Run",
      description: null,
      venue_name: "Grand City",
      venue_address: "Jl. Mustajab",
      map_location: null,
      timezone: "Asia/Jakarta",
      start_at: toIsoString("2026-09-04T10:00"),
      end_at: toIsoString("2026-09-04T20:00"),
      status: "DRAFT",
    };
    expect(detailsFromEvent(fromApi(api))).toEqual({
      name: "Paw Race",
      startAt: "2026-09-04T10:00",
      endAt: "2026-09-04T20:00",
      venueName: "Grand City",
      venueAddress: "Jl. Mustajab",
      tagline: "Run",
    });
  });
});

describe("eventInitials", () => {
  it("takes the first letter of up to three words and skips numbers", () => {
    expect(eventInitials("Surabaya Paw Race 2026")).toBe("SPR");
    expect(eventInitials("Jakarta Pet Festival 2026")).toBe("JPF");
    expect(eventInitials("Bandung Happy Paws Championship")).toBe("BHP");
    expect(eventInitials("Expo")).toBe("E");
  });
  it("falls back to EV", () => {
    expect(eventInitials("")).toBe("EV");
    expect(eventInitials("2026")).toBe("EV");
  });
});

describe("serverErrorsToFormErrors", () => {
  it("maps API field names to form field names", () => {
    expect(
      serverErrorsToFormErrors({
        name: ["An event with this name already exists."],
        end_at: ["The end at must be after start at.", "Check it."],
        organization_id: ["ignored here"],
      }),
    ).toEqual({
      name: "An event with this name already exists.",
      endAt: "The end at must be after start at. Check it.",
    });
  });
  it("handles a missing errors object", () => {
    expect(serverErrorsToFormErrors(undefined)).toEqual({});
  });
});
