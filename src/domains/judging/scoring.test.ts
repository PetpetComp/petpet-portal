import { describe, expect, it } from "vitest";
import {
  clampScore,
  normalizeScore,
  scoreToPercent,
  sliderStep,
  validateScorecard,
  weightedTotal,
  type CriterionRule,
} from "./scoring";
import type { ScoreMap } from "./types";

const rule = (over: Partial<CriterionRule> = {}): CriterionRule => ({
  id: "c1",
  name: "Appearance",
  weight: 40,
  min: 0,
  max: 10,
  noteRequired: false,
  ...over,
});

const beauty: CriterionRule[] = [
  rule({ id: "app", name: "Appearance", weight: 40 }),
  rule({ id: "beh", name: "Behavior", weight: 30 }),
  rule({ id: "pre", name: "Presentation", weight: 30, noteRequired: true }),
];

const scoreOf = (score: number | null, note = ""): ScoreMap[string] => ({
  score,
  note,
});

describe("clampScore", () => {
  it("keeps values inside the range and clamps the rest", () => {
    expect(clampScore(rule(), 7)).toBe(7);
    expect(clampScore(rule(), -3)).toBe(0);
    expect(clampScore(rule(), 12)).toBe(10);
  });

  it("turns NaN into the minimum", () => {
    expect(clampScore(rule({ min: 2 }), Number.NaN)).toBe(2);
  });
});

describe("scoreToPercent", () => {
  it("normalises against min and max", () => {
    expect(scoreToPercent(rule(), 7.5)).toBe(75);
    expect(scoreToPercent(rule({ min: 5, max: 10 }), 7.5)).toBe(50);
    expect(scoreToPercent(rule({ min: 5, max: 10 }), 5)).toBe(0);
  });

  it("clamps to 0..100 and tolerates an invalid range", () => {
    expect(scoreToPercent(rule(), 15)).toBe(100);
    expect(scoreToPercent(rule(), -1)).toBe(0);
    expect(scoreToPercent(rule({ min: 5, max: 5 }), 5)).toBe(0);
    expect(scoreToPercent(rule({ min: 9, max: 3 }), 5)).toBe(0);
  });
});

describe("weightedTotal", () => {
  it("is 0..100 for weights 40/30/30 (8, 6, 9 -> 77)", () => {
    const scores: ScoreMap = {
      app: scoreOf(8),
      beh: scoreOf(6),
      pre: scoreOf(9, "ok"),
    };
    expect(weightedTotal(beauty, scores)).toBe(77);
  });

  it("is 100 for full marks and 0 for the minimum", () => {
    const full: ScoreMap = {
      app: scoreOf(10),
      beh: scoreOf(10),
      pre: scoreOf(10),
    };
    const lowest: ScoreMap = {
      app: scoreOf(0),
      beh: scoreOf(0),
      pre: scoreOf(0),
    };
    expect(weightedTotal(beauty, full)).toBe(100);
    expect(weightedTotal(beauty, lowest)).toBe(0);
  });

  it("counts missing scores as 0 percent but keeps their weight in the divisor", () => {
    // Appearance 10 (40 points of 100): the other two criteria are still empty.
    expect(weightedTotal(beauty, { app: scoreOf(10) })).toBe(40);
    expect(weightedTotal(beauty, { app: scoreOf(null) })).toBe(0);
    expect(weightedTotal(beauty, {})).toBe(0);
  });

  it("handles a minimum other than 0", () => {
    const criteria = [rule({ id: "a", weight: 1, min: 1, max: 5 })];
    expect(weightedTotal(criteria, { a: scoreOf(3) })).toBe(50);
  });

  it("stays 0..100 when the weights do not add up to 100", () => {
    const criteria = [
      rule({ id: "a", weight: 2 }),
      rule({ id: "b", weight: 1 }),
    ];
    // (100 * 2 + 40 * 1) / 3 = 80
    expect(weightedTotal(criteria, { a: scoreOf(10), b: scoreOf(4) })).toBe(80);
    const heavy = [
      rule({ id: "a", weight: 250 }),
      rule({ id: "b", weight: 250 }),
    ];
    expect(weightedTotal(heavy, { a: scoreOf(10), b: scoreOf(10) })).toBe(100);
  });

  it("returns 0 when the weights add up to zero", () => {
    const criteria = [rule({ id: "a", weight: 0 })];
    expect(weightedTotal(criteria, { a: scoreOf(10) })).toBe(0);
    expect(weightedTotal([], {})).toBe(0);
  });

  it("rounds to one decimal", () => {
    const criteria = [
      rule({ id: "a", weight: 1 }),
      rule({ id: "b", weight: 1 }),
      rule({ id: "c", weight: 1 }),
    ];
    // (100 + 0 + 0) / 3 = 33.333...
    expect(weightedTotal(criteria, { a: scoreOf(10) })).toBe(33.3);
  });
});

describe("validateScorecard", () => {
  const complete: ScoreMap = {
    app: scoreOf(8),
    beh: scoreOf(6),
    pre: scoreOf(9, "Great"),
  };

  it("passes a complete scorecard", () => {
    expect(validateScorecard(beauty, complete)).toEqual({
      valid: true,
      errors: {},
      firstInvalidId: null,
    });
  });

  it("flags every criterion without a score", () => {
    const result = validateScorecard(beauty, { app: scoreOf(8) });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(["beh", "pre"]);
    expect(result.errors.beh).toBe("Score is required for Behavior.");
    expect(result.firstInvalidId).toBe("beh");
  });

  it("treats a null score and NaN as missing", () => {
    const result = validateScorecard(beauty, {
      ...complete,
      app: scoreOf(null),
      beh: scoreOf(Number.NaN),
    });
    expect(Object.keys(result.errors)).toEqual(["app", "beh"]);
  });

  it("flags scores outside the range", () => {
    const result = validateScorecard(beauty, {
      ...complete,
      app: scoreOf(11),
      beh: scoreOf(-1),
    });
    expect(result.errors.app).toBe(
      "Score for Appearance must be between 0 and 10.",
    );
    expect(result.errors.beh).toContain("Behavior");
  });

  it("requires a note only where the criterion asks for one", () => {
    const result = validateScorecard(beauty, {
      ...complete,
      pre: scoreOf(9, "   "),
    });
    expect(result.errors).toEqual({
      pre: "A note is required for Presentation.",
    });
    expect(
      validateScorecard(beauty, { ...complete, app: scoreOf(8, "") }).valid,
    ).toBe(true);
  });

  it("reports the score problem before the note problem", () => {
    const result = validateScorecard(beauty, {
      ...complete,
      pre: scoreOf(null),
    });
    expect(result.errors.pre).toBe("Score is required for Presentation.");
  });
});

describe("sliderStep", () => {
  it("uses 1 for wide ranges", () => {
    expect(sliderStep({ min: 0, max: 10 })).toBe(1);
    expect(sliderStep({ min: 0, max: 100 })).toBe(1);
    expect(sliderStep({ min: 5, max: 15 })).toBe(1);
  });

  it("uses 0.5 for ranges between 1 and 10", () => {
    expect(sliderStep({ min: 1, max: 5 })).toBe(0.5);
    expect(sliderStep({ min: 0, max: 9 })).toBe(0.5);
  });

  it("uses 0.1 for ranges of 1 or less and 1 for an invalid range", () => {
    expect(sliderStep({ min: 0, max: 1 })).toBe(0.1);
    expect(sliderStep({ min: 0, max: 0.5 })).toBe(0.1);
    expect(sliderStep({ min: 3, max: 3 })).toBe(1);
  });
});

describe("normalizeScore", () => {
  it("snaps to the step counted from the minimum", () => {
    expect(normalizeScore({ min: 0, max: 10 }, 7.4)).toBe(7);
    expect(normalizeScore({ min: 1, max: 5 }, 3.3)).toBe(3.5);
    expect(normalizeScore({ min: 0, max: 1 }, 0.30000000000000004)).toBe(0.3);
  });

  it("clamps after snapping", () => {
    expect(normalizeScore({ min: 0, max: 10 }, 99)).toBe(10);
    expect(normalizeScore({ min: 2, max: 12 }, -4)).toBe(2);
  });
});
