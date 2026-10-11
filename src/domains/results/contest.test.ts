import { describe, expect, it } from "vitest";
import { combineJudges, rankContest } from "./contest";

// Bobot 40/30/30, rentang 0..10 (sama dengan seed Beauty Class Open).
const criteria = [
  { id: "a", weight: 40, min: 0, max: 10 },
  { id: "b", weight: 30, min: 0, max: 10 },
  { id: "c", weight: 30, min: 0, max: 10 },
];
const card = (a: number, b: number, c: number) => ({
  scores: {
    a: { score: a, note: "" },
    b: { score: b, note: "" },
    c: { score: c, note: "" },
  },
});

describe("combineJudges", () => {
  it("averages the 0-100 totals of every locked card", () => {
    // Juri A: 8,6,9 -> 77. Juri B: 6,8,7 -> 69. Rata-rata 73.
    const result = combineJudges(criteria, [card(8, 6, 9), card(6, 8, 7)]);
    expect(result.score).toBe(73);
    expect(result.judges).toBe(2);
  });
  it("returns no score without locked cards", () => {
    expect(combineJudges(criteria, [])).toEqual({
      score: null,
      judges: 0,
      tieBreak: [],
    });
  });
  it("orders the tie-break vector by weight, heaviest first", () => {
    const result = combineJudges(criteria, [card(10, 0, 5)]);
    expect(result.tieBreak[0]).toBe(100); // kriteria a (bobot 40)
  });
});

describe("rankContest", () => {
  const entry = (entryId: string, cards: ReturnType<typeof card>[]) => ({
    entryId,
    ...combineJudges(criteria, cards),
  });

  it("ranks the higher score first and skips unscored entries", () => {
    const ranks = rankContest([
      entry("low", [card(5, 5, 5)]),
      entry("none", []),
      entry("high", [card(9, 9, 9)]),
    ]);
    expect(ranks.get("high")).toBe(1);
    expect(ranks.get("low")).toBe(2);
    expect(ranks.has("none")).toBe(false);
  });

  it("breaks a tie with the heaviest criterion", () => {
    // Kedua total 70: x = (10,0,10) -> 70, y = (7,7,7) -> 70. x menang di Appearance.
    const x = entry("x", [card(10, 0, 10)]);
    const y = entry("y", [card(7, 7, 7)]);
    expect(x.score).toBe(y.score);
    const ranks = rankContest([y, x]);
    expect(ranks.get("x")).toBe(1);
    expect(ranks.get("y")).toBe(2);
  });

  it("gives equal entries the same rank and skips the next number", () => {
    const ranks = rankContest([
      entry("p", [card(8, 8, 8)]),
      entry("q", [card(8, 8, 8)]),
      entry("r", [card(2, 2, 2)]),
    ]);
    expect(ranks.get("p")).toBe(1);
    expect(ranks.get("q")).toBe(1);
    expect(ranks.get("r")).toBe(3);
  });
});
