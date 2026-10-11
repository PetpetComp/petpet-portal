import { describe, expect, it } from "vitest";
import {
  allLanesResolved,
  laneStatus,
  matchOutcomes,
  rankFinishes,
  type LaneRankInput,
} from "./rank";
import type { MatchLane, RaceSession } from "./types";

/** Satu lane menunggu tanpa finish; `over` mengubah sebagian. */
const lane = (n: number, over: Partial<LaneRankInput> = {}): LaneRankInput => ({
  heatEntryId: `he${n}`,
  laneNumber: n,
  callStatus: "WAITING",
  finishTimeMs: null,
  finishOrder: null,
  disqualified: false,
  ...over,
});
const finished = (n: number, ms: number, order: number) =>
  lane(n, { finishTimeMs: ms, finishOrder: order });

describe("laneStatus", () => {
  it("DNS wins over everything, then DQ, then DNF, then FINISHED", () => {
    expect(
      laneStatus(lane(1, { callStatus: "DNS", disqualified: true }), null),
    ).toBe("DNS");
    expect(laneStatus(finished(1, 1000, 1), null)).toBe("FINISHED");
    expect(
      laneStatus({ ...finished(1, 1000, 1), disqualified: true }, null),
    ).toBe("DQ");
    expect(laneStatus(lane(1), null)).toBe("DNF");
  });
  it("makes a finish after the cut-off a DNF, but not exactly at it", () => {
    expect(laneStatus(finished(1, 90001, 1), 90000)).toBe("DNF");
    expect(laneStatus(finished(1, 90000, 1), 90000)).toBe("FINISHED");
    expect(laneStatus(finished(1, 999999, 1), null)).toBe("FINISHED");
    expect(laneStatus(finished(1, 999999, 1), 0)).toBe("FINISHED");
  });
});

describe("rankFinishes", () => {
  it("orders finishers by time, then DNF, DQ and DNS, with positions 1..n", () => {
    const ranked = rankFinishes([
      lane(1, { callStatus: "DNS" }),
      finished(2, 40000, 2),
      lane(3, { disqualified: true }),
      finished(4, 31000, 1),
      lane(5),
    ]);
    expect(ranked.map((r) => [r.heatEntryId, r.position, r.status])).toEqual([
      ["he4", 1, "FINISHED"],
      ["he2", 2, "FINISHED"],
      ["he5", 3, "DNF"],
      ["he3", 4, "DQ"],
      ["he1", 5, "DNS"],
    ]);
  });
  it("keeps the raw time only for finishers", () => {
    const ranked = rankFinishes([
      finished(1, 38412, 1),
      { ...finished(2, 30000, 2), disqualified: true },
      lane(3),
    ]);
    expect(ranked.map((r) => r.completedTimeMs)).toEqual([38412, null, null]);
  });
  it("breaks an equal time by the earlier finish_order, then by lane", () => {
    const ranked = rankFinishes([
      finished(1, 30000, 2),
      finished(2, 30000, 1),
      finished(3, 30000, 3),
    ]);
    expect(ranked.map((r) => r.heatEntryId)).toEqual(["he2", "he1", "he3"]);
    // Tanpa finishOrder, nomor lane yang memutus.
    const byLane = rankFinishes([
      lane(2, { finishTimeMs: 100 }),
      lane(1, { finishTimeMs: 100 }),
    ]);
    expect(byLane.map((r) => r.heatEntryId)).toEqual(["he1", "he2"]);
  });
  it("orders DNF, DQ and DNS by lane number", () => {
    const ranked = rankFinishes([
      lane(4),
      lane(2),
      lane(3, { disqualified: true }),
      lane(1),
    ]);
    expect(ranked.map((r) => [r.heatEntryId, r.status])).toEqual([
      ["he1", "DNF"],
      ["he2", "DNF"],
      ["he4", "DNF"],
      ["he3", "DQ"],
    ]);
  });
  it("turns finishes past the cut-off into DNF", () => {
    const ranked = rankFinishes(
      [finished(1, 95000, 2), finished(2, 80000, 1), lane(3)],
      90000,
    );
    expect(
      ranked.map((r) => [r.heatEntryId, r.status, r.completedTimeMs]),
    ).toEqual([
      ["he2", "FINISHED", 80000],
      ["he1", "DNF", null],
      ["he3", "DNF", null],
    ]);
  });
  it("handles an empty match, a single lane and does not change the input", () => {
    expect(rankFinishes([])).toEqual([]);
    expect(rankFinishes([lane(1)])).toEqual([
      { heatEntryId: "he1", position: 1, status: "DNF", completedTimeMs: null },
    ]);
    const input = [finished(2, 2, 2), finished(1, 1, 1)];
    const copy = structuredClone(input);
    rankFinishes(input);
    expect(input).toEqual(copy);
  });
  it("gives the same answer however the input is ordered", () => {
    const rows = [
      finished(3, 30000, 2),
      finished(1, 30000, 1),
      lane(2),
      lane(4, { callStatus: "DNS" }),
    ];
    expect(rankFinishes([...rows].reverse())).toEqual(rankFinishes(rows));
  });
});

describe("allLanesResolved", () => {
  it("is true only when every lane finished, did not start or was disqualified", () => {
    expect(
      allLanesResolved([
        finished(1, 1000, 1),
        lane(2, { callStatus: "DNS" }),
        lane(3, { disqualified: true }),
      ]),
    ).toBe(true);
    expect(allLanesResolved([finished(1, 1000, 1), lane(2)])).toBe(false);
    expect(allLanesResolved([])).toBe(false);
  });
});

describe("matchOutcomes", () => {
  const laneView = (n: number, over: Partial<MatchLane> = {}): MatchLane => ({
    heatEntryId: `he${n}`,
    entryId: `e${n}`,
    laneNumber: n,
    petName: "Pet",
    petMorphName: "",
    ownerName: "Owner",
    bibNumber: "001",
    callStatus: "WAITING",
    position: null,
    completedTimeMs: null,
    finish: null,
    penalties: [],
    disqualification: null,
    actions: {
      finish: false,
      undoFinish: false,
      markDns: false,
      undoDns: false,
      disqualify: false,
      undoDisqualify: false,
    },
    ...over,
  });
  const session = (cutoffTimeMs: number): RaceSession => ({
    id: "s1",
    matchId: "h1",
    number: 1,
    rematchOfId: null,
    countdownSeconds: 3,
    cutoffTimeMs,
    startedAt: null,
    stoppedAt: null,
    stopReason: null,
    status: "FINISHED",
    captures: [],
  });

  it("ranks the lanes of a match using the finish, DNS and DQ shown on each lane", () => {
    const lanes = [
      laneView(1, {
        finish: { captureId: "c1", finishOrder: 2, capturedTimeMs: 40000 },
      }),
      laneView(2, {
        finish: { captureId: "c2", finishOrder: 1, capturedTimeMs: 35000 },
      }),
      laneView(3, { callStatus: "DNS" }),
      laneView(4, {
        disqualification: {
          id: "p1",
          entryId: "e4",
          type: "DISQUALIFICATION",
          unit: "DISQUALIFICATION",
          value: 0,
          reason: "False start",
          status: "ACTIVE",
          issuedAt: "2026-10-11T08:00:00+00:00",
        },
      }),
    ];
    expect(
      matchOutcomes({ lanes, currentSession: session(90000) }).map((o) => [
        o.heatEntryId,
        o.position,
        o.status,
        o.completedTimeMs,
      ]),
    ).toEqual([
      ["he2", 1, "FINISHED", 35000],
      ["he1", 2, "FINISHED", 40000],
      ["he4", 3, "DQ", null],
      ["he3", 4, "DNS", null],
    ]);
  });
  it("applies the cut-off of the current session", () => {
    const lanes = [
      laneView(1, {
        finish: { captureId: "c1", finishOrder: 1, capturedTimeMs: 70000 },
      }),
    ];
    expect(
      matchOutcomes({ lanes, currentSession: session(60000) })[0].status,
    ).toBe("DNF");
    expect(matchOutcomes({ lanes, currentSession: null })[0].status).toBe(
      "FINISHED",
    );
  });
});
