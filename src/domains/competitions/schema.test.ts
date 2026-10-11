import { describe, expect, it } from "vitest";
import { competitionFixture } from "@/test/fixtures";
import {
  criterionCode,
  editCompetitionSchema,
  editToApi,
  editValuesFromCompetition,
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

describe("editCompetitionSchema", () => {
  const valid = {
    name: "Paw Sprint",
    description: "",
    arenaName: "Main",
    capacity: "40",
    startAt: "2026-09-04T10:00",
    endAt: "2026-09-04T12:00",
  };
  it("accepts the basics and turns a typed capacity into a number", () => {
    const parsed = editCompetitionSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.capacity).toBe(40);
  });
  it("rejects an empty name and an end before the start", () => {
    const issues =
      editCompetitionSchema
        .safeParse({ ...valid, name: " ", endAt: "2026-09-04T09:00" })
        .error?.issues.map((i) => i.path.join(".") + ": " + i.message) ?? [];
    expect(issues).toContain("name: Give the competition a name");
    expect(issues).toContain("endAt: Must be after the start");
  });
  it("leaves the capacity empty when blank", () => {
    const parsed = editCompetitionSchema.parse({ ...valid, capacity: "" });
    expect(parsed.capacity).toBeUndefined();
  });
});

describe("edit values and payload", () => {
  it("prefills the form from the competition in browser time", () => {
    const start = new Date(2026, 8, 4, 10, 0);
    const end = new Date(2026, 8, 4, 12, 30);
    const values = editValuesFromCompetition(
      competitionFixture({
        name: "Paw Sprint",
        description: "Fast",
        arenaName: "Main",
        capacity: null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }),
    );
    expect(values).toEqual({
      name: "Paw Sprint",
      description: "Fast",
      arenaName: "Main",
      capacity: "",
      startAt: "2026-09-04T10:00",
      endAt: "2026-09-04T12:30",
    });
  });
  it("sends empty optional text and capacity as null, dates as ISO", () => {
    const body = editToApi(
      editCompetitionSchema.parse({
        name: "Paw Sprint",
        description: "  ",
        arenaName: "",
        capacity: "",
        startAt: "2026-09-04T10:00",
        endAt: "2026-09-04T12:00",
      }),
    );
    expect(body).toEqual({
      name: "Paw Sprint",
      description: null,
      arena_name: null,
      capacity: null,
      scheduled_start_at: new Date("2026-09-04T10:00").toISOString(),
      scheduled_end_at: new Date("2026-09-04T12:00").toISOString(),
    });
  });
});
