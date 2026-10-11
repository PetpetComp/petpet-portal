import { describe, expect, it } from "vitest";
import {
  buildDrawing,
  buildQueue,
  draftMatches,
  entryIdsOf,
  matchCount,
  matchSizes,
  queueLaneCount,
  shuffled,
  swapInDrawing,
} from "./draw";
import type { DrawingParticipant } from "./types";

/** Membuat n id entry: e1, e2, ... en. */
const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);
const sizes = (matches: string[][]) => matches.map((m) => m.length);

describe("matchCount", () => {
  it("rounds up participants / lanes", () => {
    expect(matchCount(45, 5)).toBe(9);
    expect(matchCount(11, 5)).toBe(3);
    expect(matchCount(6, 5)).toBe(2);
    expect(matchCount(1, 5)).toBe(1);
    expect(matchCount(0, 5)).toBe(0);
  });
  it("rejects an invalid lane count", () => {
    expect(() => matchCount(5, 0)).toThrow(RangeError);
    expect(() => matchCount(5, 2.5)).toThrow(RangeError);
  });
});

describe("matchSizes (balanced, larger first)", () => {
  it("spreads 11 pets over 5 lanes as 4+4+3, not 5+5+1", () => {
    expect(matchSizes(11, 5)).toEqual([4, 4, 3]);
  });
  it("fills nine matches of 5 for 45 pets", () => {
    expect(matchSizes(45, 5)).toEqual(Array(9).fill(5));
  });
  it("handles the small cases", () => {
    expect(matchSizes(1, 5)).toEqual([1]);
    expect(matchSizes(2, 5)).toEqual([2]);
    expect(matchSizes(6, 5)).toEqual([3, 3]);
    expect(matchSizes(0, 5)).toEqual([]);
  });
  it("makes one match per pet with a single lane", () => {
    expect(matchSizes(4, 1)).toEqual([1, 1, 1, 1]);
  });
});

describe("buildDrawing", () => {
  const cases: [number, number][] = [
    [11, 5],
    [45, 5],
    [1, 5],
    [2, 5],
    [6, 5],
    [13, 5],
    [7, 1],
    [9, 4],
  ];
  it.each(cases)(
    "draws %i pets on %i lanes: each pet once, never above lanes",
    (n, lanes) => {
      const matches = buildDrawing(ids(n), lanes, 7);
      const flat = matches.flat();
      expect(flat).toHaveLength(n);
      expect(new Set(flat).size).toBe(n);
      expect([...flat].sort()).toEqual([...ids(n)].sort());
      expect(Math.max(...sizes(matches))).toBeLessThanOrEqual(lanes);
      expect(sizes(matches)).toEqual(matchSizes(n, lanes));
    },
  );

  it("never leaves a single-pet match when it can be avoided", () => {
    for (let n = 2; n <= 60; n++)
      expect(Math.min(...sizes(buildDrawing(ids(n), 5, n)))).toBeGreaterThan(1);
  });

  it("returns no match for zero pets", () => {
    expect(buildDrawing([], 5, 1)).toEqual([]);
    expect(buildDrawing([], 5)).toEqual([]);
  });

  it("is deterministic for the same seed and differs for another", () => {
    const a = buildDrawing(ids(20), 5, 123);
    expect(buildDrawing(ids(20), 5, 123)).toEqual(a);
    expect(buildDrawing(ids(20), 5, 124)).not.toEqual(a);
  });

  it("actually shuffles (not the input order) and works without a seed", () => {
    expect(buildDrawing(ids(20), 5, 123).flat()).not.toEqual(ids(20));
    const random = buildDrawing(ids(20), 5);
    expect(new Set(random.flat()).size).toBe(20);
  });

  it("does not change its input", () => {
    const input = ids(10);
    buildDrawing(input, 5, 9);
    expect(input).toEqual(ids(10));
  });

  it("rejects an invalid lane count", () => {
    expect(() => buildDrawing(ids(3), 0)).toThrow(RangeError);
  });
});

describe("shuffled", () => {
  it("keeps every item and leaves the source alone", () => {
    const source = [1, 2, 3, 4, 5];
    const out = shuffled(source, 5);
    expect([...out].sort()).toEqual(source);
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("swapInDrawing", () => {
  const matches = [
    ["a", "b", "c"],
    ["d", "e"],
  ];
  it("swaps two pets across matches and keeps their positions", () => {
    expect(swapInDrawing(matches, "b", "e")).toEqual([
      ["a", "e", "c"],
      ["d", "b"],
    ]);
  });
  it("swaps two pets inside one match", () => {
    expect(swapInDrawing(matches, "a", "c")).toEqual([
      ["c", "b", "a"],
      ["d", "e"],
    ]);
  });
  it("returns a copy and leaves the input alone", () => {
    swapInDrawing(matches, "a", "d");
    expect(matches).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });
  it("keeps every pet exactly once", () => {
    const out = swapInDrawing(matches, "a", "e").flat().sort();
    expect(out).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("throws for an unknown pet or the same pet twice", () => {
    expect(() => swapInDrawing(matches, "a", "zzz")).toThrow();
    expect(() => swapInDrawing(matches, "a", "a")).toThrow();
  });
});

describe("draftMatches and entryIdsOf", () => {
  const participants: DrawingParticipant[] = ["a", "b", "c"].map((id) => ({
    entryId: id,
    petName: id.toUpperCase(),
    ownerName: "Owner",
    bibNumber: "001",
  }));
  it("builds screen matches with lane numbers and round-trips back to ids", () => {
    const drafts = draftMatches(participants, [["c", "a"], ["b"]]);
    expect(drafts[0]).toMatchObject({
      id: "draft-1",
      number: 1,
      status: "SCHEDULED",
    });
    expect(drafts[0].lanes.map((l) => [l.laneNumber, l.petName])).toEqual([
      [1, "C"],
      [2, "A"],
    ]);
    expect(entryIdsOf(drafts)).toEqual([["c", "a"], ["b"]]);
  });
  it("throws for an unknown participant", () => {
    expect(() => draftMatches(participants, [["zzz"]])).toThrow();
  });
});

describe("time trial queue", () => {
  it("uses as many lanes as participants, at least one", () => {
    expect(queueLaneCount(6)).toBe(6);
    expect(queueLaneCount(1)).toBe(1);
    expect(queueLaneCount(0)).toBe(1);
  });

  it("draws ONE match holding every participant once (lane = queue position)", () => {
    for (const n of [1, 2, 6, 13, 45]) {
      const queue = buildQueue(ids(n), 3);
      expect(queue).toHaveLength(1);
      expect(queue[0]).toHaveLength(n);
      expect([...queue[0]].sort()).toEqual([...ids(n)].sort());
    }
  });

  it("is deterministic for the same seed, shuffles, and gives no match for nobody", () => {
    expect(buildQueue(ids(10), 5)).toEqual(buildQueue(ids(10), 5));
    expect(buildQueue(ids(10), 5)[0]).not.toEqual(ids(10));
    expect(buildQueue([], 5)).toEqual([]);
  });

  it("leaves Race drawing untouched (11 pets on 5 lanes stay 4+4+3)", () => {
    expect(buildDrawing(ids(11), 5, 7).map((m) => m.length)).toEqual([4, 4, 3]);
  });

  it("round-trips with swap like any drawing", () => {
    const queue = buildQueue(ids(4), 1);
    const [a, b] = [queue[0][0], queue[0][3]];
    const swapped = swapInDrawing(queue, a, b);
    expect(swapped[0][0]).toBe(b);
    expect(swapped[0][3]).toBe(a);
  });
});
