import { describe, expect, it } from "vitest";
import {
  applyScorecard,
  applyScorecardCreated,
  nextUnscored,
  queueProgress,
} from "./queue";
import type {
  Judging,
  JudgingParticipant,
  JudgingStatus,
  Scorecard,
} from "./types";

const item = (entryId: string, status: JudgingStatus) => ({ entryId, status });

const queue = [
  item("e1", "LOCKED"),
  item("e2", "LOCKED"),
  item("e3", "DRAFT"),
  item("e4", "NOT_SCORED"),
  item("e5", "NOT_SCORED"),
];

describe("queueProgress", () => {
  it("counts finished, draft and untouched participants", () => {
    expect(queueProgress(queue)).toEqual({
      total: 5,
      scored: 2,
      draft: 1,
      notScored: 2,
      percent: 40,
    });
  });

  it("counts SUBMITTED as finished and handles an empty queue", () => {
    expect(queueProgress([item("a", "SUBMITTED")]).scored).toBe(1);
    expect(queueProgress([])).toEqual({
      total: 0,
      scored: 0,
      draft: 0,
      notScored: 0,
      percent: 0,
    });
  });
});

describe("nextUnscored", () => {
  it("returns the next participant that still needs work", () => {
    expect(nextUnscored(queue, "e1")).toBe("e3");
    expect(nextUnscored(queue, "e3")).toBe("e4");
    expect(nextUnscored(queue, "e4")).toBe("e5");
  });

  it("wraps around to the start", () => {
    expect(nextUnscored(queue, "e5")).toBe("e3");
  });

  it("skips the current participant even when it is not finished", () => {
    expect(
      nextUnscored([item("a", "DRAFT"), item("b", "LOCKED")], "a"),
    ).toBeNull();
  });

  it("starts from the beginning without a current participant", () => {
    expect(nextUnscored(queue, null)).toBe("e3");
    expect(nextUnscored(queue, "unknown")).toBe("e3");
  });

  it("returns null when everything is done or the queue is empty", () => {
    expect(
      nextUnscored([item("a", "LOCKED"), item("b", "SUBMITTED")], "a"),
    ).toBe(null);
    expect(nextUnscored([], null)).toBeNull();
  });
});

const criteria = [
  {
    id: "c1",
    code: "A",
    name: "A",
    description: "",
    weight: 50,
    min: 0,
    max: 10,
    noteRequired: false,
    displayOrder: 1,
    active: true,
  },
  {
    id: "c2",
    code: "B",
    name: "B",
    description: "",
    weight: 50,
    min: 0,
    max: 10,
    noteRequired: true,
    displayOrder: 2,
    active: true,
  },
];

const participant = (
  entryId: string,
  status: JudgingStatus,
): JudgingParticipant => ({
  entryId,
  queueNumber: 1,
  bibNumber: "001",
  petName: "Chibi",
  petMorphName: "",
  ownerName: "Owner",
  checkedInAt: null,
  scorecardId: status === "NOT_SCORED" ? null : "sc-1",
  status,
  scores: {},
  judgeNote: "",
  total: null,
  submittedAt: null,
  lockedAt: null,
  actions: { score: true, submit: false },
});

const judging = (canScore = true): Judging => ({
  competitionId: "comp",
  roundId: "round-comp-1",
  criteria,
  participants: [participant("e1", "NOT_SCORED"), participant("e2", "LOCKED")],
  scoredCount: 1,
  totalCount: 2,
  judge: null,
  canScore,
});

const card = (over: Partial<Scorecard>): Scorecard => ({
  id: "sc-1",
  roundId: "round-comp-1",
  entryId: "e1",
  staffAssignmentId: "sa",
  status: "DRAFT",
  judgeNote: "",
  submittedAt: null,
  lockedAt: null,
  scores: {},
  ...over,
});

describe("applyScorecard", () => {
  it("writes status, scores, total and actions into the participant", () => {
    const next = applyScorecard(
      judging(),
      card({ scores: { c1: { score: 10, note: "" } } }),
    );
    const p = next.participants[0];
    expect(p.status).toBe("DRAFT");
    expect(p.scorecardId).toBe("sc-1");
    expect(p.total).toBe(50);
    // Criterion B is missing, so the scorecard cannot be submitted yet.
    expect(p.actions).toEqual({ score: true, submit: false });
  });

  it("enables submit when every criterion is valid", () => {
    const next = applyScorecard(
      judging(),
      card({
        scores: {
          c1: { score: 10, note: "" },
          c2: { score: 10, note: "ok" },
        },
      }),
    );
    expect(next.participants[0].actions.submit).toBe(true);
    expect(next.participants[0].total).toBe(100);
  });

  it("turns off every action once the scorecard is not a draft", () => {
    const next = applyScorecard(
      judging(),
      card({
        status: "LOCKED",
        scores: { c1: { score: 5, note: "" }, c2: { score: 5, note: "x" } },
      }),
    );
    expect(next.participants[0].actions).toEqual({
      score: false,
      submit: false,
    });
    expect(next.scoredCount).toBe(2);
  });

  it("does not allow editing for a caller who cannot score", () => {
    const next = applyScorecard(judging(false), card({}));
    expect(next.participants[0].actions.score).toBe(false);
  });

  it("leaves the other participants and unknown entries alone", () => {
    const base = judging();
    const next = applyScorecard(base, card({ entryId: "zzz" }));
    expect(next.participants).toEqual(base.participants);
  });
});

describe("applyScorecardCreated", () => {
  it("moves a NOT_SCORED participant to DRAFT with the new id", () => {
    const next = applyScorecardCreated(judging(), "e1", "sc-9");
    expect(next.participants[0]).toMatchObject({
      scorecardId: "sc-9",
      status: "DRAFT",
    });
  });

  it("keeps the status of a participant that already has a scorecard", () => {
    const next = applyScorecardCreated(judging(), "e2", "sc-9");
    expect(next.participants[1].status).toBe("LOCKED");
  });
});
