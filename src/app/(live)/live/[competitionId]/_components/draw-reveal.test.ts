import { describe, expect, it } from "vitest";
import {
  matchOffsets,
  revealTiming,
  settledCountAt,
  spinIndex,
} from "./draw-reveal";

describe("revealTiming", () => {
  it("uses 140ms stagger for small drawings and shrinks it for large ones", () => {
    expect(revealTiming(5).staggerMs).toBe(140);
    expect(revealTiming(13).staggerMs).toBeCloseTo(2200 / 13);
    expect(revealTiming(200).staggerMs).toBeCloseTo(11);
  });

  it("keeps the total duration at or below 3.2s for any size", () => {
    for (const slots of [1, 13, 45, 200]) {
      expect(revealTiming(slots).totalMs).toBeLessThanOrEqual(3200);
    }
  });
});

describe("settledCountAt", () => {
  it("settles nothing during the spin and everything at the end", () => {
    expect(settledCountAt(0, 5)).toBe(0);
    expect(settledCountAt(599, 5)).toBe(0);
    expect(settledCountAt(revealTiming(5).totalMs, 5)).toBe(5);
  });

  it("settles one slot per stagger in reading order", () => {
    expect(settledCountAt(600, 5)).toBe(1);
    expect(settledCountAt(740, 5)).toBe(2);
    expect(settledCountAt(1160, 5)).toBe(5);
    expect(settledCountAt(99999, 5)).toBe(5);
  });

  it("returns 0 for an empty drawing", () => {
    expect(settledCountAt(5000, 0)).toBe(0);
  });
});

describe("spinIndex and matchOffsets", () => {
  it("always stays inside the pool", () => {
    for (let frame = 0; frame < 50; frame += 1) {
      const index = spinIndex(7, 3, frame);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(7);
    }
  });

  it("computes the first slot of each match", () => {
    expect(matchOffsets([3, 2, 1])).toEqual([0, 3, 5]);
    expect(matchOffsets([])).toEqual([]);
  });
});
