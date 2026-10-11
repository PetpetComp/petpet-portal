import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  LockError,
  createScorecardBody,
  criterionScoresBody,
  ensureScorecard,
  getJudging,
  lockScorecard,
  saveJudgeNote,
  saveScores,
  submitAndLock,
  submitBody,
} from "./api";

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    ApiError,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
  };
});

const respond = (data: unknown) => ({ success: true, message: "OK", data });

const apiCard = (over: Record<string, unknown> = {}) => ({
  uuid: "sc-1",
  round_uuid: "round-1",
  entry_uuid: "e1",
  staff_assignment_uuid: "sa-1",
  status: "DRAFT",
  weighted_total: null,
  judge_note: null,
  submitted_at: null,
  locked_at: null,
  total_score: 0,
  max_total_score: 0,
  criterion_scores: [],
  ...over,
});

beforeEach(() => vi.resetAllMocks());

describe("bodies", () => {
  it("builds the create body with only the entry", () => {
    expect(createScorecardBody({ entryId: "e1" })).toEqual({ entry_id: "e1" });
  });

  it("sends only the given criteria and omits an untouched note", () => {
    expect(
      criterionScoresBody([
        { criterionId: "c1", score: 8 },
        { criterionId: "c2", score: 7, note: "Calm" },
        { criterionId: "c3", score: 6, note: "" },
      ]),
    ).toEqual({
      scores: [
        { criterion_id: "c1", score: 8 },
        { criterion_id: "c2", score: 7, note: "Calm" },
        { criterion_id: "c3", score: 6, note: "" },
      ],
    });
  });

  it("adds the judge note to the submit body only when given", () => {
    expect(submitBody()).toEqual({ status: "SUBMITTED" });
    expect(submitBody("Nice")).toEqual({
      status: "SUBMITTED",
      judge_note: "Nice",
    });
  });
});

describe("getJudging", () => {
  it("reads the judging endpoint and maps it", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      respond({
        competition_uuid: "comp",
        round_uuid: "round-comp-1",
        criteria: [],
        participants: [],
        scored_count: 0,
        total_count: 0,
        judge: null,
        actions: { can_score: false },
      }),
    );
    const judging = await getJudging("comp");
    expect(apiClient.get).toHaveBeenCalledWith("/competitions/comp/judging");
    expect(judging.roundId).toBe("round-comp-1");
    expect(judging.canScore).toBe(false);
  });
});

describe("ensureScorecard", () => {
  it("makes no request when the scorecard is known", async () => {
    await expect(
      ensureScorecard({ roundId: "r", entryId: "e1", scorecardId: "sc-1" }),
    ).resolves.toBe("sc-1");
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("creates the scorecard and returns its id", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiCard()));
    await expect(
      ensureScorecard({ roundId: "round-1", entryId: "e1" }),
    ).resolves.toBe("sc-1");
    expect(apiClient.post).toHaveBeenCalledWith("/rounds/round-1/scorecards", {
      entry_id: "e1",
    });
  });

  it("finds the existing scorecard when the real backend refuses a duplicate", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError(
        422,
        "You already have a scorecard for this entry in this round.",
      ),
    );
    vi.mocked(apiClient.get).mockResolvedValue(
      respond([
        apiCard({ uuid: "other", staff_assignment_uuid: "sa-2" }),
        apiCard({ uuid: "mine" }),
      ]),
    );
    await expect(
      ensureScorecard({
        roundId: "round-1",
        entryId: "e1",
        staffAssignmentId: "sa-1",
      }),
    ).resolves.toBe("mine");
  });

  it("rethrows other errors and duplicates it cannot resolve", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(403, "No"));
    await expect(
      ensureScorecard({ roundId: "r", entryId: "e1", staffAssignmentId: "sa" }),
    ).rejects.toMatchObject({ status: 403 });
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError(422, "You already have a scorecard"),
    );
    await expect(
      ensureScorecard({ roundId: "r", entryId: "e1" }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("saveScores and saveJudgeNote", () => {
  it("puts the changed criteria and maps the scorecard", async () => {
    vi.mocked(apiClient.put).mockResolvedValue(
      respond(
        apiCard({
          criterion_scores: [
            {
              uuid: "cs",
              criterion_uuid: "c1",
              score: 8,
              weighted_score: 320,
              note: null,
            },
          ],
        }),
      ),
    );
    const card = await saveScores("sc-1", [{ criterionId: "c1", score: 8 }]);
    expect(apiClient.put).toHaveBeenCalledWith(
      "/scorecards/sc-1/criterion-scores",
      { scores: [{ criterion_id: "c1", score: 8 }] },
    );
    expect(card.scores).toEqual({ c1: { score: 8, note: "" } });
  });

  it("patches the judge note", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(
      respond(apiCard({ judge_note: "Nice" })),
    );
    const card = await saveJudgeNote("sc-1", "Nice");
    expect(apiClient.patch).toHaveBeenCalledWith("/scorecards/sc-1", {
      judge_note: "Nice",
    });
    expect(card.judgeNote).toBe("Nice");
  });
});

describe("submitAndLock", () => {
  it("submits and then locks with two requests", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(
      respond(apiCard({ status: "SUBMITTED" })),
    );
    vi.mocked(apiClient.post).mockResolvedValue(
      respond(apiCard({ status: "LOCKED" })),
    );
    const card = await submitAndLock("sc-1", "Nice");
    expect(apiClient.patch).toHaveBeenCalledWith("/scorecards/sc-1", {
      status: "SUBMITTED",
      judge_note: "Nice",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/scorecards/sc-1/lock", {});
    expect(card.status).toBe("LOCKED");
  });

  it("stops at a submit error without trying to lock", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new ApiError(403, "No"));
    await expect(submitAndLock("sc-1")).rejects.toMatchObject({ status: 403 });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("rethrows a submit validation error while the scorecard is still a draft", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(
      new ApiError(
        422,
        "All active criteria must be scored before submitting.",
      ),
    );
    vi.mocked(apiClient.get).mockResolvedValue(respond(apiCard()));
    await expect(submitAndLock("sc-1")).rejects.toMatchObject({ status: 422 });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("throws a LockError carrying the submitted scorecard when lock fails", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(
      respond(apiCard({ status: "SUBMITTED" })),
    );
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError(0, "Network error."),
    );
    vi.mocked(apiClient.get).mockResolvedValue(
      respond(apiCard({ status: "SUBMITTED" })),
    );
    const error = await submitAndLock("sc-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LockError);
    const lockError = error as LockError;
    expect(lockError.scorecardId).toBe("sc-1");
    expect(lockError.submitted.status).toBe("SUBMITTED");
    expect(lockError.status).toBe(0);
  });

  it("continues to lock when the scorecard was already submitted", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(
      new ApiError(409, "This scorecard is no longer editable."),
    );
    vi.mocked(apiClient.get).mockResolvedValue(
      respond(apiCard({ status: "SUBMITTED" })),
    );
    vi.mocked(apiClient.post).mockResolvedValue(
      respond(apiCard({ status: "LOCKED" })),
    );
    await expect(submitAndLock("sc-1")).resolves.toMatchObject({
      status: "LOCKED",
    });
  });

  it("returns an already locked scorecard as it is", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new ApiError(409, "Locked"));
    vi.mocked(apiClient.get).mockResolvedValue(
      respond(apiCard({ status: "LOCKED" })),
    );
    await expect(submitAndLock("sc-1")).resolves.toMatchObject({
      status: "LOCKED",
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe("lockScorecard", () => {
  it("counts a refused lock as success when the scorecard turns out to be locked", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(409, "Already"));
    vi.mocked(apiClient.get).mockResolvedValue(
      respond(apiCard({ status: "LOCKED" })),
    );
    await expect(lockScorecard("sc-1")).resolves.toMatchObject({
      status: "LOCKED",
    });
  });

  it("rethrows a refused lock when the scorecard is not locked", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError(422, "Only a submitted scorecard can be locked."),
    );
    vi.mocked(apiClient.get).mockResolvedValue(respond(apiCard()));
    await expect(lockScorecard("sc-1")).rejects.toMatchObject({ status: 422 });
  });

  it("does not look again for a network error", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(0, "Network"));
    await expect(lockScorecard("sc-1")).rejects.toMatchObject({ status: 0 });
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
