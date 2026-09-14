import { describe, it, expect } from "vitest";
import { parseAssessments, assessmentFor, totalScore, isReadyToComplete } from "./contest-rules";

const criteria = [
  { name: "Appearance", maxPoints: 100 },
  { name: "Creativity", maxPoints: 50 },
];

describe("parseAssessments", () => {
  it("returns an empty object for missing or invalid JSON", () => {
    expect(parseAssessments(undefined)).toEqual({});
    expect(parseAssessments("not-json")).toEqual({});
  });
  it("parses valid JSON", () => {
    const data = { "PET-1": { status: "waiting", scores: {} } };
    expect(parseAssessments(JSON.stringify(data))).toEqual(data);
  });
});

describe("assessmentFor", () => {
  it("defaults to waiting with no scores when absent", () => {
    expect(assessmentFor({}, "PET-1")).toEqual({ status: "waiting", scores: {} });
  });
});

describe("totalScore", () => {
  it("sums scores across all criteria", () => {
    expect(
      totalScore({ status: "judging", scores: { Appearance: 80, Creativity: 40 } }, criteria),
    ).toBe(120);
    expect(totalScore({ status: "waiting", scores: {} }, criteria)).toBe(0);
  });
});

describe("isReadyToComplete", () => {
  it("requires every criterion to have a valid score", () => {
    expect(
      isReadyToComplete({ status: "judging", scores: { Appearance: 80, Creativity: 40 } }, criteria),
    ).toBe(true);
    expect(
      isReadyToComplete({ status: "judging", scores: { Appearance: 80 } }, criteria),
    ).toBe(false);
    expect(
      isReadyToComplete({ status: "judging", scores: { Appearance: 80, Creativity: 60 } }, criteria),
    ).toBe(false);
  });
});
