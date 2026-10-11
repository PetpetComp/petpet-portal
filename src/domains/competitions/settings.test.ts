import { describe, expect, it } from "vitest";
import { toDatetimeLocal } from "@/domains/events/schema";
import {
  DEFAULT_RANKING_RULE,
  formatCutoff,
  hasNoChanges,
  isValidCutoff,
  missingChannelTypes,
  parseCutoff,
  settingsChanges,
  settingsSchema,
  settingsValues,
  type Settings,
} from "./settings";
import type { CompetitionRule, RegistrationPeriod } from "./types";

const rule: CompetitionRule = {
  id: "r2",
  version: 2,
  countdownEnabled: false,
  countdownSeconds: 5,
  concurrentParticipantLimit: 8,
  timeLimitMs: 90000,
  attemptLimit: 2,
  checkpointTotal: null,
  laneTotal: 5,
  qualifierLimit: 4,
  bestResultMethod: "BEST",
  rankingRule: ["POSITION_ASC"],
  tieBreakRule: ["TIME_ASC"],
  timeoutResult: "DNF",
  isActive: true,
};

const early: RegistrationPeriod = {
  id: "p1",
  competitionId: "c1",
  type: "EARLY_BIRD",
  price: 70000,
  quota: null,
  startAt: new Date(2026, 6, 12, 8, 0).toISOString(),
  endAt: new Date(2026, 6, 26, 23, 59).toISOString(),
  status: "ACTIVE",
};
const online: RegistrationPeriod = {
  ...early,
  id: "p2",
  type: "ONLINE",
  price: 85000,
  quota: 50,
};
const onSite: RegistrationPeriod = {
  ...early,
  id: "p3",
  type: "ON_SITE",
  status: "CLOSED",
};
const periods = [onSite, online, early];

/** Nilai form dari data server, lalu lolos schema seperti saat tombol Save ditekan. */
function parsed(over: Record<string, unknown> = {}): Settings {
  return settingsSchema.parse({ ...settingsValues(rule, periods), ...over });
}
const change = (values: Settings, r: CompetitionRule | null = rule) =>
  settingsChanges({ values, rule: r, periods, resultMode: "POSITION" });

describe("cut-off time", () => {
  it("formats milliseconds as mm:ss", () => {
    expect(formatCutoff(90000)).toBe("01:30");
    expect(formatCutoff(3725000)).toBe("62:05");
    expect(formatCutoff(null)).toBe("");
    expect(formatCutoff(0)).toBe("");
  });
  it("parses mm:ss back to milliseconds", () => {
    expect(parseCutoff("01:30")).toBe(90000);
    expect(parseCutoff(" 2:05 ")).toBe(125000);
    expect(parseCutoff("")).toBeNull();
    expect(parseCutoff("90")).toBeNull();
    expect(parseCutoff("01:75")).toBeNull();
    expect(parseCutoff("00:00")).toBeNull();
  });
  it("accepts blank or a valid time only", () => {
    expect(isValidCutoff("")).toBe(true);
    expect(isValidCutoff("01:30")).toBe(true);
    expect(isValidCutoff("1m30")).toBe(false);
  });
});

describe("settingsValues", () => {
  it("fills the form from the rule and orders channels early bird, online, on the spot", () => {
    const v = settingsValues(rule, periods);
    expect(v.laneTotal).toBe(5);
    expect(v.cutoff).toBe("01:30");
    expect(v.periods.map((p) => p.type)).toEqual([
      "EARLY_BIRD",
      "ONLINE",
      "ON_SITE",
    ]);
    expect(v.periods[2].closed).toBe(true);
    expect(v.periods[1]).toMatchObject({
      periodId: "p2",
      price: 85000,
      quota: 50,
      startAt: toDatetimeLocal(online.startAt),
    });
  });
  it("starts empty without a rule", () => {
    expect(settingsValues(null, [])).toEqual({
      laneTotal: "",
      checkpointTotal: "",
      cutoff: "",
      periods: [],
    });
  });
});

describe("settingsSchema", () => {
  it("accepts the values that came from the server", () => {
    expect(
      settingsSchema.safeParse(settingsValues(rule, periods)).success,
    ).toBe(true);
  });
  it("rejects a bad cut-off, a negative price and an end before the start", () => {
    const v = settingsValues(rule, periods);
    const result = settingsSchema.safeParse({
      ...v,
      cutoff: "abc",
      periods: [
        { ...v.periods[0], price: -1, endAt: "2020-01-01T00:00" },
        v.periods[1],
        v.periods[2],
      ],
    });
    const issues = result.error?.issues.map(
      (i) => i.path.join(".") + ": " + i.message,
    );
    expect(issues).toContain("cutoff: Use mm:ss, for example 01:30");
    expect(issues).toContain("periods.0.price: Price can't be negative");
    expect(issues).toContain("periods.0.endAt: Must be after the start");
  });
  it("rejects zero lanes", () => {
    const result = settingsSchema.safeParse({
      ...settingsValues(rule, periods),
      laneTotal: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["laneTotal"]);
  });
});

describe("settingsChanges", () => {
  it("reports nothing when the form still equals the server data", () => {
    expect(hasNoChanges(change(parsed()))).toBe(true);
  });

  it("creates a new rule version that keeps every other field of the old one", () => {
    const changes = change(parsed({ laneTotal: "6" }));
    expect(changes.rule).toEqual({
      countdown_enabled: false,
      countdown_seconds: 5,
      concurrent_participant_limit: 8,
      attempt_limit: 2,
      qualifier_limit: 4,
      best_result_method: "BEST",
      tie_break_rule: ["TIME_ASC"],
      timeout_result: "DNF",
      ranking_rule: ["POSITION_ASC"],
      lane_total: 6,
      checkpoint_total: null,
      time_limit_ms: 90000,
    });
    expect(changes.periodUpdates).toEqual([]);
    expect(changes.periodCreates).toEqual([]);
  });

  it("turns a cleared cut-off into null", () => {
    expect(change(parsed({ cutoff: "" })).rule?.time_limit_ms).toBeNull();
    expect(change(parsed({ cutoff: "02:00" })).rule?.time_limit_ms).toBe(
      120000,
    );
  });

  it("makes no rule when there is none and nothing was typed", () => {
    const empty = settingsSchema.parse(settingsValues(null, []));
    expect(
      settingsChanges({
        values: empty,
        rule: null,
        periods: [],
        resultMode: "TIME",
      }).rule,
    ).toBeNull();
  });

  it("uses a default ranking rule for the type when no version exists yet", () => {
    const first = settingsSchema.parse({
      ...settingsValues(null, []),
      laneTotal: "4",
    });
    const changes = settingsChanges({
      values: first,
      rule: null,
      periods: [],
      resultMode: "TIME",
    });
    expect(changes.rule?.ranking_rule).toEqual(DEFAULT_RANKING_RULE.TIME);
    expect(changes.rule?.lane_total).toBe(4);
  });

  it("patches only the channel that changed and always sends both dates together", () => {
    const v = settingsValues(rule, periods);
    const values = settingsSchema.parse({
      ...v,
      periods: [v.periods[0], { ...v.periods[1], price: 90000 }, v.periods[2]],
    });
    expect(change(values).periodUpdates).toEqual([
      { id: "p2", type: "ONLINE", body: { price: 90000 } },
    ]);

    const moved = settingsSchema.parse({
      ...v,
      periods: [
        { ...v.periods[0], endAt: "2026-07-30T12:00" },
        v.periods[1],
        v.periods[2],
      ],
    });
    const body = change(moved).periodUpdates[0].body;
    expect(Object.keys(body).sort()).toEqual([
      "registration_end_at",
      "registration_start_at",
    ]);
  });

  it("clears a quota with null", () => {
    const v = settingsValues(rule, periods);
    const values = settingsSchema.parse({
      ...v,
      periods: [v.periods[0], { ...v.periods[1], quota: "" }, v.periods[2]],
    });
    expect(change(values).periodUpdates[0].body).toEqual({ quota: null });
  });

  it("posts a new channel", () => {
    const v = settingsValues(rule, [early]);
    const values = settingsSchema.parse({
      ...v,
      periods: [
        ...v.periods,
        {
          periodId: "",
          type: "ONLINE",
          closed: false,
          price: 85000,
          quota: "",
          startAt: "2026-07-27T00:00",
          endAt: "2026-08-31T23:59",
        },
      ],
    });
    const changes = settingsChanges({
      values,
      rule,
      periods: [early],
      resultMode: "POSITION",
    });
    expect(changes.periodCreates).toEqual([
      {
        period_type: "ONLINE",
        price: 85000,
        quota: undefined,
        registration_start_at: new Date("2026-07-27T00:00").toISOString(),
        registration_end_at: new Date("2026-08-31T23:59").toISOString(),
      },
    ]);
    expect(changes.periodUpdates).toEqual([]);
  });

  it("never sends a channel that is already closed", () => {
    const values = parsed();
    values.periods[2].price = 5;
    expect(change(values).periodUpdates).toEqual([]);
  });
});

describe("missingChannelTypes", () => {
  it("lists the types without a row", () => {
    expect(missingChannelTypes([{ type: "ONLINE" }])).toEqual([
      "EARLY_BIRD",
      "ON_SITE",
    ]);
    expect(
      missingChannelTypes([
        { type: "EARLY_BIRD" },
        { type: "ONLINE" },
        { type: "ON_SITE" },
      ]),
    ).toEqual([]);
  });
});
