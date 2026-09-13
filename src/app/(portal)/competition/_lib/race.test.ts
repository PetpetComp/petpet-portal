import { describe, it, expect } from "vitest";
import {
  raceReducer,
  initialRace,
  validPositions,
  formatRaceTime,
} from "./race";
describe("race lifecycle", () => {
  it("rejects captures before start and after cutoff", () => {
    expect(
      raceReducer(initialRace, {
        type: "capture",
        value: 100,
        limit: 4,
        cutoff: 60000,
      }).captures,
    ).toEqual([]);
    const countdown = raceReducer(initialRace, { type: "countdown" });
    const running = raceReducer(countdown, { type: "start" });
    expect(
      raceReducer(running, {
        type: "capture",
        value: 60000,
        limit: 4,
        cutoff: 60000,
      }).captures,
    ).toEqual([]);
    expect(
      raceReducer(running, { type: "tick", value: 61000, cutoff: 60000 }),
    ).toMatchObject({ status: "Stopped", elapsed: 60000 });
  });
  it("limits captures to participant count", () => {
    const running = { ...initialRace, status: "Running" as const };
    const captured = raceReducer(running, {
      type: "capture",
      value: 1100,
      limit: 1,
      cutoff: 60000,
    });
    expect(
      raceReducer(captured, {
        type: "capture",
        value: 1200,
        limit: 1,
        cutoff: 60000,
      }).captures,
    ).toEqual([1100]);
  });
  it("requires unique positions with matching captures", () => {
    expect(validPositions(["1", "1"], 2)).toBe(false);
    expect(validPositions(["1", "2"], 1)).toBe(false);
    expect(validPositions(["1", "DNS"], 2)).toBe(false);
    expect(validPositions(["1", "DNS", "DSQ"], 1)).toBe(true);
    expect(validPositions([""], 1)).toBe(false);
    expect(validPositions([], 0)).toBe(false);
  });
  it("formats timer without losing milliseconds", () => {
    expect(formatRaceTime(61234)).toBe("01:01.234");
  });
});
