import { describe, expect, it } from "vitest";
import { fromApi, type ApiCompetition } from "./types";

const row: ApiCompetition = {
  uuid: "c1",
  event_uuid: "e1",
  competition_type_uuid: "ct1",
  species_uuid: null,
  name: "Beauty Class Open",
  slug: "beauty-class-open",
  description: null,
  arena_name: null,
  capacity: 40,
  scheduled_start_at: "2026-10-10T09:00:00+07:00",
  scheduled_end_at: null,
  minimum_judges: 3,
  registration_closed_at: null,
  status: "SCHEDULED",
  registration_open: true,
  registration_closed_reason: null,
  active_registration_period: {
    uuid: "per1",
    period_type: "ON_SITE",
    price: "90000.00",
    registration_end_at: "2026-10-10T10:00:00+00:00",
  },
  actions: {
    publish: false,
    start: true,
    complete: false,
    cancel: true,
    close_registration: true,
  },
};

describe("competitions fromApi", () => {
  it("maps the active registration period and actions", () => {
    const c = fromApi(row);
    expect(c.activeRegistrationPeriod).toEqual({
      id: "per1",
      type: "ON_SITE",
      price: 90000,
      endsAt: "2026-10-10T10:00:00+00:00",
    });
    expect(c.actions).toEqual({
      publish: false,
      start: true,
      complete: false,
      cancel: true,
      closeRegistration: true,
    });
  });

  it("keeps a missing period as null", () => {
    expect(
      fromApi({ ...row, active_registration_period: null })
        .activeRegistrationPeriod,
    ).toBeNull();
  });
});
