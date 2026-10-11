import { describe, expect, it } from "vitest";
import type { LaneOutcome, MatchLane } from "@/domains/matches/types";
import type { PendingFinish } from "./finish-queue";
import { laneView, ordinal } from "./lane-view";

const lane: MatchLane = {
  heatEntryId: "he1",
  entryId: "e1",
  laneNumber: 1,
  petName: "Niko",
  petMorphName: "Caramel",
  ownerName: "Damar",
  bibNumber: "113",
  callStatus: "WAITING",
  position: null,
  completedTimeMs: null,
  finish: null,
  penalties: [],
  disqualification: null,
  actions: {
    finish: true,
    undoFinish: false,
    markDns: true,
    undoDns: false,
    disqualify: false,
    undoDisqualify: false,
  },
};

const pending: PendingFinish = {
  clientRequestId: "r1",
  sessionId: "s1",
  entryId: "e1",
  laneNumber: 1,
  petName: "Niko",
  finishOrder: 1,
  capturedTimeMs: 38412,
  status: "sending",
  capture: null,
  error: null,
};

const outcome = (over: Partial<LaneOutcome>): LaneOutcome => ({
  heatEntryId: "he1",
  position: 1,
  status: "FINISHED",
  completedTimeMs: 31250,
  ...over,
});

describe("laneView", () => {
  it("shows a sending finish as Finished with the local time (optimistic)", () => {
    expect(laneView(lane, pending, null, "RUNNING")).toEqual({
      chip: "FINISHED",
      timeMs: 38412,
      rank: null,
      final: false,
    });
  });

  it("shows queued and unassigned items as Pending and Not assigned", () => {
    expect(
      laneView(lane, { ...pending, status: "waiting" }, null, "RUNNING").chip,
    ).toBe("PENDING");
    expect(
      laneView(lane, { ...pending, status: "rejected" }, null, "RUNNING").chip,
    ).toBe("PENDING");
    expect(
      laneView(lane, { ...pending, status: "unassigned" }, null, "RUNNING")
        .chip,
    ).toBe("NOT_ASSIGNED");
  });

  it("uses the provisional outcome while racing, without showing DNF yet", () => {
    expect(laneView(lane, null, outcome({}), "RUNNING")).toEqual({
      chip: "FINISHED",
      timeMs: 31250,
      rank: 1,
      final: false,
    });
    expect(
      laneView(
        lane,
        null,
        outcome({ status: "DNF", completedTimeMs: null, position: 2 }),
        "RUNNING",
      ).chip,
    ).toBeNull();
  });

  it("shows DNF after the session stopped, and DNS or DQ at any time", () => {
    const dnf = outcome({ status: "DNF", completedTimeMs: null });
    expect(laneView(lane, null, dnf, "STOPPED").chip).toBe("DNF");
    expect(laneView(lane, null, outcome({ status: "DNS" }), "IDLE").chip).toBe(
      "DNS",
    );
    expect(
      laneView(lane, null, outcome({ status: "DQ" }), "RUNNING").chip,
    ).toBe("DQ");
  });

  it("reads the stored result when the match is DONE", () => {
    const done = { ...lane, callStatus: "FINISHED" as const, position: 2 };
    expect(
      laneView({ ...done, completedTimeMs: 40000 }, null, null, "DONE"),
    ).toEqual({ chip: "FINISHED", timeMs: 40000, rank: 2, final: true });
    expect(
      laneView({ ...lane, callStatus: "DNF" }, null, null, "DONE").chip,
    ).toBe("DNF");
  });

  it("has no chip for a lane that has not raced and has no outcome", () => {
    expect(laneView(lane, null, null, "READY").chip).toBeNull();
  });
});

describe("ordinal", () => {
  it("writes English ordinals including the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      [
        "1st",
        "2nd",
        "3rd",
        "4th",
        "11th",
        "12th",
        "13th",
        "21st",
        "22nd",
        "23rd",
        "101st",
        "111th",
      ],
    );
  });
});
