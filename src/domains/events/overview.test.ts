import { describe, expect, it } from "vitest";
import type { CompetitionType } from "@/domains/competitions/types";
import {
  barPercent,
  kindOfResultMode,
  kindSummary,
  setupSteps,
  sponsorSummary,
} from "./overview";

const type = (id: string, resultMode: CompetitionType["resultMode"]) => ({
  id,
  code: id,
  name: id,
  resultMode,
});
const types = [
  type("race", "POSITION"),
  type("cp", "CHECKPOINT"),
  type("tt", "TIME"),
  type("beauty", "JUDGED_SCORE"),
];

describe("kindOfResultMode", () => {
  it("maps result modes to the design's competition kinds", () => {
    expect(kindOfResultMode("POSITION")).toBe("race");
    expect(kindOfResultMode("TIME")).toBe("time_trial");
    expect(kindOfResultMode("CHECKPOINT")).toBe("checkpoint");
    expect(kindOfResultMode("JUDGED_SCORE")).toBe("contest");
    expect(kindOfResultMode("COMBINED")).toBe("contest");
  });
});

describe("kindSummary", () => {
  it("lists kinds in design order and skips the empty ones", () => {
    const competitions = [
      ...Array(5).fill({ typeId: "race" }),
      ...Array(2).fill({ typeId: "cp" }),
      { typeId: "tt" },
      { typeId: "beauty" },
    ];
    expect(kindSummary(competitions, types)).toBe(
      "5 race · 2 checkpoint · 1 time trial · 1 contest",
    );
    expect(kindSummary([{ typeId: "tt" }], types)).toBe("1 time trial");
    expect(kindSummary([], types)).toBe("");
  });
  it("counts an unknown type as a race", () => {
    expect(kindSummary([{ typeId: "???" }], types)).toBe("1 race");
  });
});

describe("sponsorSummary", () => {
  it("orders levels from platinum down and calls media partners media", () => {
    expect(sponsorSummary({ MEDIA_PARTNER: 2, GOLD: 2, PLATINUM: 2 })).toBe(
      "2 platinum · 2 gold · 2 media",
    );
  });
  it("keeps unknown levels at the end", () => {
    expect(sponsorSummary({ GOLD: 1, VIP: 3 })).toBe("1 gold · 3 vip");
    expect(sponsorSummary({})).toBe("");
  });
});

describe("barPercent", () => {
  it("is relative to the biggest value", () => {
    expect(barPercent(72, 72)).toBe(100);
    expect(barPercent(18, 72)).toBe(25);
    expect(barPercent(0, 72)).toBe(0);
  });
  it("is 0 when everything is 0", () => {
    expect(barPercent(0, 0)).toBe(0);
  });
});

describe("setupSteps", () => {
  it("marks each step from the counts", () => {
    const steps = setupSteps({
      competitions: 9,
      staff: 0,
      sponsors: 8,
      published: false,
    });
    expect(steps.map((s) => [s.label, s.done])).toEqual([
      ["Event details", true],
      ["9 competitions added", true],
      ["Committee invited", false],
      ["8 sponsors linked", true],
      ["Event published", false],
    ]);
  });
  it("treats a count that could not be loaded as not done", () => {
    const steps = setupSteps({
      competitions: null,
      staff: null,
      sponsors: null,
      published: true,
    });
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false, true]);
    expect(steps[1].label).toBe("Competitions added");
  });
  it("uses the singular for one", () => {
    expect(
      setupSteps({
        competitions: 1,
        staff: 1,
        sponsors: 1,
        published: false,
      })[1].label,
    ).toBe("1 competition added");
  });
});
