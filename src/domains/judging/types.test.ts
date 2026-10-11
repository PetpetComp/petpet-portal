import { describe, expect, it } from "vitest";
import {
  fromApi,
  participantFromApi,
  scorecardFromApi,
  type ApiJudging,
  type ApiJudgingParticipant,
  type ApiScorecard,
} from "./types";

const apiCriterion = (uuid: string, weight: string, order: number) => ({
  uuid,
  competition_uuid: "comp",
  code: uuid.toUpperCase(),
  name: `Criterion ${uuid}`,
  description: null,
  weight,
  min_score: "0.00",
  max_score: "10.00",
  note_required: uuid === "c2",
  display_order: order,
  status: "ACTIVE" as const,
});

const apiParticipant = (
  over: Partial<ApiJudgingParticipant> = {},
): ApiJudgingParticipant => ({
  entry_uuid: "e1",
  queue_number: 1,
  bib_number: "001",
  pet_name: "Chibi",
  pet_morph_name: "Classic Grey",
  owner_name: "Rina Putri",
  checked_in_at: "2026-10-10T07:15:00+00:00",
  scorecard_uuid: null,
  status: "NOT_SCORED",
  scores: [],
  judge_note: null,
  total: null,
  submitted_at: null,
  locked_at: null,
  actions: { score: true, submit: false },
  ...over,
});

const apiJudging = (over: Partial<ApiJudging> = {}): ApiJudging => ({
  competition_uuid: "comp",
  round_uuid: "round-comp-1",
  criteria: [apiCriterion("c2", "50.00", 2), apiCriterion("c1", "50.00", 1)],
  participants: [
    apiParticipant({ entry_uuid: "e2", queue_number: 2 }),
    apiParticipant(),
  ],
  scored_count: 0,
  total_count: 2,
  judge: { staff_assignment_uuid: "sa-1", assignment_role: "JUDGE" },
  actions: { can_score: true },
  ...over,
});

describe("scorecardFromApi", () => {
  const api: ApiScorecard = {
    uuid: "sc-1",
    round_uuid: "round-comp-1",
    entry_uuid: "e1",
    staff_assignment_uuid: "sa-1",
    status: "SUBMITTED",
    weighted_total: 770,
    judge_note: null,
    submitted_at: "2026-10-10T09:30:00+00:00",
    locked_at: null,
    total_score: 15,
    max_total_score: 20,
    criterion_scores: [
      {
        uuid: "cs-1",
        criterion_uuid: "c1",
        score: 8,
        weighted_score: 320,
        note: null,
      },
      {
        uuid: "cs-2",
        criterion_uuid: "c2",
        score: 7,
        weighted_score: 210,
        note: "Calm",
      },
    ],
  };

  it("maps the API shape to camelCase and a score map", () => {
    expect(scorecardFromApi(api)).toEqual({
      id: "sc-1",
      roundId: "round-comp-1",
      entryId: "e1",
      staffAssignmentId: "sa-1",
      status: "SUBMITTED",
      judgeNote: "",
      submittedAt: "2026-10-10T09:30:00+00:00",
      lockedAt: null,
      scores: {
        c1: { score: 8, note: "" },
        c2: { score: 7, note: "Calm" },
      },
    });
  });
});

describe("participantFromApi", () => {
  const criteria = fromApi(apiJudging()).criteria;

  it("has no total without scores", () => {
    const p = participantFromApi(apiParticipant(), criteria);
    expect(p.total).toBeNull();
    expect(p.scores).toEqual({});
    expect(p.scorecardId).toBeNull();
    expect(p.status).toBe("NOT_SCORED");
  });

  it("recomputes the total on the client instead of reading the API value", () => {
    const p = participantFromApi(
      apiParticipant({
        scorecard_uuid: "sc-1",
        status: "DRAFT",
        total: 999,
        scores: [{ criterion_uuid: "c1", score: 10, note: null }],
      }),
      criteria,
    );
    expect(p.total).toBe(50);
  });

  it("falls back for missing names and copies the flags", () => {
    const p = participantFromApi(
      apiParticipant({
        pet_name: null,
        pet_morph_name: null,
        bib_number: null,
        actions: { score: false, submit: false },
      }),
      criteria,
    );
    expect(p).toMatchObject({
      petName: "Unnamed pet",
      petMorphName: "",
      bibNumber: "",
      actions: { score: false, submit: false },
    });
  });
});

describe("fromApi", () => {
  it("orders criteria by display order and participants by queue number", () => {
    const judging = fromApi(apiJudging());
    expect(judging.criteria.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(judging.participants.map((p) => p.entryId)).toEqual(["e1", "e2"]);
  });

  it("maps weights, notes, judge and flags", () => {
    const judging = fromApi(apiJudging());
    expect(judging.criteria[1]).toMatchObject({
      weight: 50,
      min: 0,
      max: 10,
      noteRequired: true,
    });
    expect(judging).toMatchObject({
      competitionId: "comp",
      roundId: "round-comp-1",
      totalCount: 2,
      canScore: true,
      judge: { staffAssignmentId: "sa-1", role: "JUDGE" },
    });
  });

  it("has no judge for a caller who is not assigned", () => {
    expect(fromApi(apiJudging({ judge: null })).judge).toBeNull();
  });
});
