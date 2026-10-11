import { describe, expect, it } from "vitest";
import {
  bestTimesPanel,
  participantProgress,
  rankBestTimes,
  upNext,
  type RankInput,
} from "./rank";
import type { QueueParticipant, QueueState } from "./types";

const input = (over: Partial<RankInput> & { entryId: string }): RankInput => ({
  drawingOrder: 1,
  bestTimeMs: null,
  bestStoppedAt: null,
  disqualified: false,
  ...over,
});

describe("rankBestTimes", () => {
  it("ranks by the fastest best time", () => {
    const ranks = rankBestTimes([
      input({ entryId: "a", bestTimeMs: 41000, drawingOrder: 1 }),
      input({ entryId: "b", bestTimeMs: 38412, drawingOrder: 2 }),
      input({ entryId: "c", bestTimeMs: 44870, drawingOrder: 3 }),
    ]);
    expect([...ranks]).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });

  it("leaves out participants without a valid time", () => {
    const ranks = rankBestTimes([
      input({ entryId: "a", bestTimeMs: 41000 }),
      input({ entryId: "b", bestTimeMs: null }),
    ]);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.has("b")).toBe(false);
  });

  it("leaves out a disqualified participant even with the fastest time", () => {
    const ranks = rankBestTimes([
      input({ entryId: "a", bestTimeMs: 30000, disqualified: true }),
      input({ entryId: "b", bestTimeMs: 41000 }),
    ]);
    expect([...ranks]).toEqual([["b", 1]]);
  });

  it("breaks a tie by the earlier achieved time", () => {
    const ranks = rankBestTimes([
      input({
        entryId: "late",
        bestTimeMs: 40000,
        bestStoppedAt: "2026-10-11T08:09:00+00:00",
        drawingOrder: 1,
      }),
      input({
        entryId: "early",
        bestTimeMs: 40000,
        bestStoppedAt: "2026-10-11T08:05:00+00:00",
        drawingOrder: 2,
      }),
    ]);
    expect(ranks.get("early")).toBe(1);
    expect(ranks.get("late")).toBe(2);
  });

  it("breaks a tie without a moment by the drawing order, and puts an unknown moment last", () => {
    const byOrder = rankBestTimes([
      input({ entryId: "second", bestTimeMs: 40000, drawingOrder: 2 }),
      input({ entryId: "first", bestTimeMs: 40000, drawingOrder: 1 }),
    ]);
    expect(byOrder.get("first")).toBe(1);
    const unknownLast = rankBestTimes([
      input({ entryId: "unknown", bestTimeMs: 40000, drawingOrder: 1 }),
      input({
        entryId: "known",
        bestTimeMs: 40000,
        bestStoppedAt: "2026-10-11T08:05:00+00:00",
        drawingOrder: 2,
      }),
    ]);
    expect(unknownLast.get("known")).toBe(1);
  });

  it("always gives unique ranks 1..k", () => {
    const ranks = rankBestTimes(
      ["a", "b", "c", "d"].map((id, i) =>
        input({ entryId: id, bestTimeMs: 40000, drawingOrder: i + 1 }),
      ),
    );
    expect([...ranks.values()].sort()).toEqual([1, 2, 3, 4]);
  });

  it("returns nothing for an empty queue", () => {
    expect(rankBestTimes([]).size).toBe(0);
  });
});

/** Peserta layar minimal untuk tes panel. */
function participant(
  entryId: string,
  over: Partial<QueueParticipant> = {},
): QueueParticipant {
  return {
    roundEntryId: `re-${entryId}`,
    entryId,
    drawingOrder: 1,
    queueNumber: 1,
    queuePosition: 1,
    status: "WAITING",
    state: "NOT_STARTED",
    petName: entryId.toUpperCase(),
    petMorphName: "",
    ownerName: "Owner",
    bibNumber: "001",
    attempts: [],
    attemptsCounted: 0,
    bestTimeMs: null,
    bestAttemptNumber: null,
    bestRank: null,
    penalties: [],
    disqualification: null,
    activeAttempt: null,
    actions: {
      createAttempt: false,
      start: false,
      stop: false,
      retry: false,
      undo: false,
      nextParticipant: false,
      skip: false,
      markDns: false,
      undoDns: false,
      disqualify: false,
      undoDisqualify: false,
      reopen: false,
    },
    ...over,
  };
}

const ranked = (id: string, rank: number, timeMs: number) =>
  participant(id, {
    bestRank: rank,
    bestTimeMs: timeMs,
    bestAttemptNumber: 1,
    queuePosition: rank,
  });

describe("bestTimesPanel", () => {
  const list = [
    participant("none"),
    ranked("c", 3, 44870),
    ranked("a", 1, 38412),
    ranked("b", 2, 41230),
    ranked("d", 4, 50000),
  ];

  it("lists the ranked participants in rank order, cut at the limit", () => {
    const rows = bestTimesPanel(list, 3);
    expect(rows.map((r) => [r.rank, r.entryId, r.timeMs])).toEqual([
      [1, "a", 38412],
      [2, "b", 41230],
      [3, "c", 44870],
    ]);
  });

  it("returns fewer rows when fewer have a time, and none for a zero limit", () => {
    expect(
      bestTimesPanel([participant("x"), ranked("y", 1, 1000)], 5),
    ).toHaveLength(1);
    expect(bestTimesPanel(list, 0)).toEqual([]);
    expect(bestTimesPanel([], 3)).toEqual([]);
  });

  it("carries the attempt number of the best attempt", () => {
    const rows = bestTimesPanel(
      [
        participant("a", {
          bestRank: 1,
          bestTimeMs: 1000,
          bestAttemptNumber: 2,
        }),
      ],
      3,
    );
    expect(rows[0]).toMatchObject({ attemptNumber: 2, petName: "A" });
  });
});

describe("upNext and participantProgress", () => {
  const state = (id: string, queuePosition: number, s: QueueState) =>
    participant(id, { queuePosition, state: s });
  const queue = [
    state("done", 1, "DONE"),
    state("current", 2, "IN_PROGRESS"),
    state("n1", 3, "NOT_STARTED"),
    state("dns", 4, "DNS"),
    state("n2", 5, "NOT_STARTED"),
  ];

  it("lists the next waiting participants after the current one, in queue order", () => {
    expect(upNext(queue, "current", 1).map((p) => p.entryId)).toEqual(["n1"]);
    expect(upNext(queue, "current", 5).map((p) => p.entryId)).toEqual([
      "n1",
      "n2",
    ]);
    expect(upNext(queue, "current", 0)).toEqual([]);
  });

  it("does not depend on the input order", () => {
    expect(
      upNext([...queue].reverse(), "current", 2).map((p) => p.entryId),
    ).toEqual(["n1", "n2"]);
  });

  it("counts closed participants plus one for 'Participant 4 of 18'", () => {
    expect(participantProgress(queue)).toEqual({ position: 3, total: 5 });
  });

  it("never goes past the total", () => {
    expect(
      participantProgress([state("a", 1, "DONE"), state("b", 2, "DQ")]),
    ).toEqual({ position: 2, total: 2 });
    expect(participantProgress([])).toEqual({ position: 0, total: 0 });
  });
});
