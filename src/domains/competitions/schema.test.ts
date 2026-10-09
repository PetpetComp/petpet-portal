import { describe, expect, it } from "vitest";
import {
  criterionCode,
  equalWeights,
  newCompetitionSchema,
  totalWeight,
  type NewCompetitionValues,
} from "./schema";

const base: NewCompetitionValues = {
  name: "Best Costume",
  typeId: "ct-beauty",
  resultMode: "JUDGED_SCORE",
  speciesId: "",
  arenaName: "",
  capacity: "",
  startAt: "2026-09-04T10:00",
  endAt: "2026-09-04T12:00",
  periods: [
    {
      type: "ONLINE",
      enabled: true,
      price: 65000,
      quota: "",
      startAt: "2026-08-01T00:00",
      endAt: "2026-09-01T00:00",
    },
  ],
  criteria: [
    { name: "Appearance", min: 0, max: 100, weight: 60, noteRequired: false },
    { name: "Behavior", min: 0, max: 10, weight: 40, noteRequired: true },
  ],
};
const errors = (v: NewCompetitionValues) =>
  newCompetitionSchema
    .safeParse(v)
    .error?.issues.map((i) => i.path.join(".") + ": " + i.message) ?? [];

describe("newCompetitionSchema", () => {
  it("accepts a complete judged competition", () => {
    expect(errors(base)).toEqual([]);
  });
  it("requires criteria weights to add up to 100", () => {
    const v = {
      ...base,
      criteria: [{ ...base.criteria[0], weight: 50 }, base.criteria[1]],
    };
    expect(errors(v)).toEqual([
      "criteria: Weights must add up to 100 (now 90)",
    ]);
  });
  it("ignores criteria for competitions that are not judged", () => {
    expect(errors({ ...base, resultMode: "TIME", criteria: [] })).toEqual([]);
  });
  it("needs at least one open registration channel", () => {
    const v = { ...base, periods: [{ ...base.periods[0], enabled: false }] };
    expect(errors(v)).toContain(
      "periods: Open at least one registration channel",
    );
  });
  it("rejects an end before the start", () => {
    expect(errors({ ...base, endAt: "2026-09-04T09:00" })).toContain(
      "endAt: Must be after the start",
    );
  });
  it("rejects a criterion that carries no weight", () => {
    const v = {
      ...base,
      criteria: [
        { ...base.criteria[0], weight: 100 },
        { ...base.criteria[1], weight: 0 },
      ],
    };
    expect(errors(v)).toContain("criteria.1.weight: Must be above 0");
  });
  it("rejects a criterion whose max is not above its min", () => {
    const v = {
      ...base,
      criteria: [{ ...base.criteria[0], max: 0 }, base.criteria[1]],
    };
    expect(errors(v)).toContain("criteria.0.max: Must be above the minimum");
  });
});

describe("helpers", () => {
  it("splits weights evenly but still totals 100", () => {
    expect(equalWeights(3)).toEqual([33.33, 33.33, 33.34]);
    expect(totalWeight(equalWeights(7).map((weight) => ({ weight })))).toBe(
      100,
    );
  });
  it("builds a stable code from the criterion name", () => {
    expect(criterionCode("Overall impression!", 2)).toBe(
      "OVERALL_IMPRESSION_3",
    );
    expect(criterionCode("  ", 0)).toBe("CRITERION_1");
  });
});
