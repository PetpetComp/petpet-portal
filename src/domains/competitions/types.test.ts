import { describe, expect, it } from "vitest";
import {
  criterionFromApi,
  currentRule,
  fromApi,
  periodFromApi,
  ruleFromApi,
  type ApiCompetition,
  type ApiCompetitionRule,
} from "./types";

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
      reopenRegistration: false,
    });
  });

  it("reads the mock-only reopen flag, and false when the backend omits it", () => {
    expect(
      fromApi({
        ...row,
        actions: { ...row.actions, reopen_registration: true },
      }).actions.reopenRegistration,
    ).toBe(true);
    expect(fromApi(row).actions.reopenRegistration).toBe(false);
  });

  it("maps the detail fields the workspace needs", () => {
    const c = fromApi({
      ...row,
      species_uuid: "sp1",
      description: "Fast",
      registration_closed_at: "2026-10-09T10:00:00+07:00",
    });
    expect(c).toMatchObject({
      speciesId: "sp1",
      description: "Fast",
      minimumJudges: 3,
      registrationClosed: true,
      registrationClosedAt: "2026-10-09T10:00:00+07:00",
    });
    expect(fromApi(row)).toMatchObject({
      speciesId: null,
      description: "",
      registrationClosedAt: null,
    });
  });

  it("keeps a missing period as null", () => {
    expect(
      fromApi({ ...row, active_registration_period: null })
        .activeRegistrationPeriod,
    ).toBeNull();
  });
});

const ruleRow: ApiCompetitionRule = {
  uuid: "r1",
  version: 1,
  countdown_enabled: true,
  countdown_seconds: 3,
  concurrent_participant_limit: null,
  time_limit_ms: 90000,
  attempt_limit: 1,
  checkpoint_total: null,
  lane_total: 5,
  qualifier_limit: null,
  best_result_method: null,
  ranking_rule: ["TIME_ASC"],
  tie_break_rule: null,
  timeout_result: null,
  is_active: true,
};

describe("rules, periods and criteria mappers", () => {
  it("maps a rule version", () => {
    expect(ruleFromApi(ruleRow)).toMatchObject({
      id: "r1",
      version: 1,
      laneTotal: 5,
      timeLimitMs: 90000,
      rankingRule: ["TIME_ASC"],
      isActive: true,
    });
  });

  it("maps a period and turns the decimal price into a number", () => {
    expect(
      periodFromApi({
        uuid: "p1",
        competition_uuid: "c1",
        period_type: "EARLY_BIRD",
        price: "70000.00",
        quota: null,
        registration_start_at: "2026-07-12T08:00:00+07:00",
        registration_end_at: "2026-07-26T23:59:00+07:00",
        status: "CLOSED",
      }),
    ).toEqual({
      id: "p1",
      competitionId: "c1",
      type: "EARLY_BIRD",
      price: 70000,
      quota: null,
      startAt: "2026-07-12T08:00:00+07:00",
      endAt: "2026-07-26T23:59:00+07:00",
      status: "CLOSED",
    });
  });

  it("maps a criterion with decimal strings", () => {
    expect(
      criterionFromApi({
        uuid: "k1",
        competition_uuid: "c1",
        code: "LOOK",
        name: "Appearance",
        description: null,
        weight: "40.00",
        min_score: "0.00",
        max_score: "10.00",
        note_required: true,
        display_order: 1,
        status: "ACTIVE",
      }),
    ).toMatchObject({
      weight: 40,
      min: 0,
      max: 10,
      noteRequired: true,
      active: true,
    });
  });
});

describe("currentRule", () => {
  const v = (version: number, isActive: boolean) =>
    ruleFromApi({
      ...ruleRow,
      uuid: "r" + version,
      version,
      is_active: isActive,
    });
  it("is null without rules", () => {
    expect(currentRule([])).toBeNull();
  });
  it("prefers the active version", () => {
    expect(currentRule([v(1, false), v(2, true), v(3, false)])?.version).toBe(
      2,
    );
  });
  it("falls back to the highest version when none is active", () => {
    expect(currentRule([v(1, false), v(3, false), v(2, false)])?.version).toBe(
      3,
    );
  });
});
