import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  RecordTimerResultError,
  attemptStatusBody,
  completeParticipant,
  createAttempt,
  createAttemptBody,
  markDns,
  recordTimerResult,
  reopenParticipant,
  retryAttempt,
  roundEntryBody,
  skipParticipant,
  stopAndRecord,
  timeoutAttempt,
  timerResultBody,
  voidAttempt,
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
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  };
});

const respond = (data: unknown) => ({ success: true, message: "OK", data });

const apiAttempt = (over: Record<string, unknown> = {}) => ({
  uuid: "a1",
  entry_uuid: "e1",
  round_uuid: "round-1",
  heat_uuid: null,
  attempt_number: 1,
  started_at: null,
  stopped_at: null,
  status: "WAITING",
  timer_result: null,
  checkpoint_results: [],
  ...over,
});

const apiResult = (over: Record<string, unknown> = {}) => ({
  uuid: "t1",
  attempt_uuid: "a1",
  raw_duration_ms: 38412,
  penalty_ms: 0,
  final_duration_ms: 38412,
  finish_status: "FINISHED",
  recorded_by_uuid: "u1",
  recorded_at: "2026-10-11T08:00:39+00:00",
  ...over,
});

const stopInput = {
  attemptId: "a1",
  rawDurationMs: 38412,
  clientRequestId: "req-1",
};

beforeEach(() => vi.resetAllMocks());

describe("bodies", () => {
  it("builds the create attempt body from the screen input", () => {
    expect(
      createAttemptBody({ roundId: "r1", entryId: "e1", attemptNumber: 2 }),
    ).toEqual({ entry_id: "e1", attempt_number: 2 });
  });

  it("builds the timer result body with the time as given and FINISHED", () => {
    expect(timerResultBody({ attemptId: "a1", rawDurationMs: 38412 })).toEqual({
      raw_duration_ms: 38412,
      penalty_ms: 0,
      finish_status: "FINISHED",
    });
  });

  it("adds the request id and penalty only when given", () => {
    expect(
      timerResultBody({
        attemptId: "a1",
        rawDurationMs: 1000,
        penaltyMs: 500,
        clientRequestId: "req-9",
      }),
    ).toEqual({
      raw_duration_ms: 1000,
      penalty_ms: 500,
      finish_status: "FINISHED",
      client_request_id: "req-9",
    });
  });

  it("builds the status and round entry bodies", () => {
    expect(attemptStatusBody("TIMEOUT")).toEqual({ status: "TIMEOUT" });
    expect(roundEntryBody("DNS")).toEqual({ status: "DNS" });
    expect(roundEntryBody("DNS", "No show")).toEqual({
      status: "DNS",
      decision_reason: "No show",
    });
  });
});

describe("attempt calls", () => {
  it("creates an attempt in the round and maps it", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiAttempt()));
    const result = await createAttempt({
      roundId: "round-1",
      entryId: "e1",
      attemptNumber: 1,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/rounds/round-1/attempts", {
      entry_id: "e1",
      attempt_number: 1,
    });
    expect(result).toMatchObject({ id: "a1", number: 1, status: "WAITING" });
  });

  it("times out, retries and undoes through the status endpoint", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(respond(apiAttempt()));
    await timeoutAttempt("a1");
    await retryAttempt("a1");
    await retryAttempt("a1", "RETRY");
    await voidAttempt("a1");
    expect(vi.mocked(apiClient.patch).mock.calls).toEqual([
      ["/attempts/a1/status", { status: "TIMEOUT" }],
      ["/attempts/a1/status", { status: "FALSE_START" }],
      ["/attempts/a1/status", { status: "RETRY" }],
      ["/attempts/a1/status", { status: "RETRY" }],
    ]);
  });
});

describe("recordTimerResult", () => {
  it("posts the time as given and maps the official time", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(
      respond(apiResult({ penalty_ms: 500, final_duration_ms: 38912 })),
    );
    const result = await recordTimerResult(stopInput);
    expect(apiClient.post).toHaveBeenCalledWith("/attempts/a1/timer-result", {
      raw_duration_ms: 38412,
      penalty_ms: 0,
      finish_status: "FINISHED",
      client_request_id: "req-1",
    });
    expect(result).toMatchObject({
      rawDurationMs: 38412,
      penaltyMs: 500,
      finalDurationMs: 38912,
    });
  });
});

describe("stopAndRecord (one tap)", () => {
  it("stops then records, with the same request id", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce(respond(apiAttempt({ status: "FINISHED" })))
      .mockResolvedValueOnce(respond(apiResult()));
    const result = await stopAndRecord(stopInput);
    expect(vi.mocked(apiClient.post).mock.calls.map((c) => c[0])).toEqual([
      "/attempts/a1/stop",
      "/attempts/a1/timer-result",
    ]);
    expect(vi.mocked(apiClient.post).mock.calls[1][1]).toMatchObject({
      client_request_id: "req-1",
    });
    expect(result.finalDurationMs).toBe(38412);
  });

  it("creates a request id when none is given", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce(respond(apiAttempt({ status: "FINISHED" })))
      .mockResolvedValueOnce(respond(apiResult()));
    await stopAndRecord({ attemptId: "a1", rawDurationMs: 1000 });
    const body = vi.mocked(apiClient.post).mock.calls[1][1] as {
      client_request_id?: string;
    };
    expect(body.client_request_id).toBeTruthy();
  });

  it("throws the original error and never records when the stop fails", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(0, "Network"));
    await expect(stopAndRecord(stopInput)).rejects.toMatchObject({ status: 0 });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("throws RecordTimerResultError holding what is needed to retry when only the record fails", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce(respond(apiAttempt({ status: "FINISHED" })))
      .mockRejectedValueOnce(new ApiError(0, "Network"));
    const error = await stopAndRecord(stopInput).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RecordTimerResultError);
    const failure = error as RecordTimerResultError;
    expect(failure.attemptId).toBe("a1");
    expect(failure.rawDurationMs).toBe(38412);
    expect(failure.clientRequestId).toBe("req-1");
    expect(failure.status).toBe(0);
    expect(failure.message).toContain("not saved");
  });

  it("reports a rejected record by its status so the screen can tell retry from refuse", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce(respond(apiAttempt({ status: "FINISHED" })))
      .mockRejectedValueOnce(new ApiError(422, "Over cut-off"));
    const error = (await stopAndRecord(stopInput).catch(
      (e: unknown) => e,
    )) as RecordTimerResultError;
    expect(error.status).toBe(422);
  });

  it("continues to record when the stop was already applied (lost response)", async () => {
    vi.mocked(apiClient.post)
      .mockRejectedValueOnce(new ApiError(422, "Only a running attempt"))
      .mockResolvedValueOnce(respond(apiResult()));
    vi.mocked(apiClient.get).mockResolvedValue(
      respond(apiAttempt({ status: "FINISHED" })),
    );
    const result = await stopAndRecord(stopInput);
    expect(apiClient.get).toHaveBeenCalledWith("/attempts/a1");
    expect(result.attemptId).toBe("a1");
  });

  it("does not record when a 422 stop means the attempt is not FINISHED", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError(422, "Only a running attempt"),
    );
    vi.mocked(apiClient.get).mockResolvedValue(
      respond(apiAttempt({ status: "WAITING" })),
    );
    await expect(stopAndRecord(stopInput)).rejects.toMatchObject({
      status: 422,
    });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
});

describe("round entry calls", () => {
  const roundEntry = {
    uuid: "re-e1",
    round_uuid: "round-1",
    entry_uuid: "e1",
    drawing_order: 1,
    queue_number: 1,
    queue_position: 1,
    status: "COMPLETED",
    decision_reason: null,
  };

  it("completes, marks DNS, undoes DNS and reopens through PATCH", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(respond(roundEntry));
    await completeParticipant("re-e1");
    await markDns("re-e1", true);
    await markDns("re-e1", false);
    await reopenParticipant("re-e1");
    expect(vi.mocked(apiClient.patch).mock.calls).toEqual([
      ["/round-entries/re-e1", { status: "COMPLETED" }],
      ["/round-entries/re-e1", { status: "DNS" }],
      ["/round-entries/re-e1", { status: "WAITING" }],
      ["/round-entries/re-e1", { status: "IN_PROGRESS" }],
    ]);
  });
});

describe("skipParticipant", () => {
  it("posts to the queue skip path and maps the returned queue", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(
      respond({
        competition_uuid: "c1",
        round_uuid: "round-1",
        drawing_status: "LOCKED",
        rules: {
          attempt_limit: 3,
          cutoff_ms: 120000,
          countdown_seconds: 3,
          ranking_rule: ["TIME_ASC"],
        },
        current_entry_uuid: null,
        items: [],
        summary: {
          total: 0,
          not_started: 0,
          in_progress: 0,
          done: 0,
          dns: 0,
          dq: 0,
        },
      }),
    );
    const queue = await skipParticipant("c1", "e1");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/competitions/c1/queue/e1/skip",
      {},
    );
    expect(queue.competitionId).toBe("c1");
  });
});
