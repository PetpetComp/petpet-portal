import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  AssignFinishError,
  captureAndAssign,
  captureBody,
  confirmBody,
  createSessionBody,
  disqualifyBody,
  markDns,
  newClientRequestId,
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

const apiCapture = (over: Record<string, unknown> = {}) => ({
  uuid: "c1",
  race_session_uuid: "s1",
  finish_order: 1,
  captured_time_ms: 38412,
  assigned_entry_uuid: null,
  captured_by_uuid: "u1",
  captured_at: "2026-10-11T08:00:00+00:00",
  assignment_status: "UNASSIGNED",
  assigned_by_uuid: null,
  assigned_at: null,
  ...over,
});

const input = {
  sessionId: "s1",
  finishOrder: 1,
  capturedTimeMs: 38412,
  entryId: "e1",
  clientRequestId: "req-1",
};

beforeEach(() => vi.resetAllMocks());

describe("captureAndAssign (one tap per lane)", () => {
  it("captures with the time as given, then assigns to the lane entry", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiCapture()));
    vi.mocked(apiClient.patch).mockResolvedValue(
      respond(
        apiCapture({
          assigned_entry_uuid: "e1",
          assignment_status: "ASSIGNED",
        }),
      ),
    );
    const result = await captureAndAssign(input);
    expect(apiClient.post).toHaveBeenCalledWith("/sessions/s1/finishes", {
      finish_order: 1,
      captured_time_ms: 38412,
      client_request_id: "req-1",
    });
    expect(apiClient.patch).toHaveBeenCalledWith("/finishes/c1/assign", {
      assigned_entry_id: "e1",
    });
    expect(result).toMatchObject({
      id: "c1",
      assignmentStatus: "ASSIGNED",
      assignedEntryId: "e1",
      capturedTimeMs: 38412,
    });
  });

  it("throws the original error and never assigns when the capture fails", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(0, "Network"));
    await expect(captureAndAssign(input)).rejects.toMatchObject({ status: 0 });
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("throws AssignFinishError holding the UNASSIGNED capture when only the assign fails", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiCapture()));
    vi.mocked(apiClient.patch).mockRejectedValue(new ApiError(0, "Network"));
    const error = await captureAndAssign(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AssignFinishError);
    const failure = error as AssignFinishError;
    expect(failure.capture).toMatchObject({
      id: "c1",
      assignmentStatus: "UNASSIGNED",
    });
    expect(failure.entryId).toBe("e1");
    expect(failure.status).toBe(0);
    expect(failure.message).toContain("recorded but not assigned");
  });

  it("reports a rejected assign by its status so the screen can tell retry from refuse", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(respond(apiCapture()));
    vi.mocked(apiClient.patch).mockRejectedValue(new ApiError(422, "Voided"));
    const error = (await captureAndAssign(input).catch(
      (e: unknown) => e,
    )) as AssignFinishError;
    expect(error.status).toBe(422);
  });
});

describe("bodies", () => {
  it("builds the capture body, with the request id only when given", () => {
    expect(captureBody({ ...input, clientRequestId: undefined })).toEqual({
      finish_order: 1,
      captured_time_ms: 38412,
    });
    expect(captureBody(input).client_request_id).toBe("req-1");
  });

  it("builds the session body, with rematch_of_session_id only for a rematch", () => {
    expect(
      createSessionBody({
        sessionNumber: 1,
        countdownSeconds: 3,
        cutoffTimeMs: 90000,
      }),
    ).toEqual({
      session_number: 1,
      countdown_seconds: 3,
      cutoff_time_ms: 90000,
    });
    expect(
      createSessionBody({
        sessionNumber: 2,
        countdownSeconds: 0,
        cutoffTimeMs: 90000,
        rematchOfSessionId: "s1",
      }),
    ).toEqual({
      session_number: 2,
      countdown_seconds: 0,
      cutoff_time_ms: 90000,
      rematch_of_session_id: "s1",
    });
  });

  it("builds Disqualify as a DISQUALIFICATION penalty of value 0", () => {
    expect(disqualifyBody("False start")).toEqual({
      penalty_type: "DISQUALIFICATION",
      penalty_value: 0,
      penalty_unit: "DISQUALIFICATION",
      reason: "False start",
    });
  });

  it("builds the confirm body from outcomes", () => {
    expect(
      confirmBody([
        {
          heatEntryId: "he1",
          position: 1,
          status: "FINISHED",
          completedTimeMs: 31250,
        },
        {
          heatEntryId: "he2",
          position: 2,
          status: "DNS",
          completedTimeMs: null,
        },
      ]),
    ).toEqual({
      results: [
        {
          heat_entry_uuid: "he1",
          position: 1,
          completed_time_ms: 31250,
          status: "FINISHED",
        },
        {
          heat_entry_uuid: "he2",
          position: 2,
          completed_time_ms: null,
          status: "DNS",
        },
      ],
    });
  });

  it("creates a new request id each time", () => {
    expect(newClientRequestId()).not.toBe(newClientRequestId());
  });
});

describe("markDns", () => {
  it("patches call_status of the heat entry", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(respond({ uuid: "he1" }));
    await markDns("he1", true);
    expect(apiClient.patch).toHaveBeenLastCalledWith("/heat-entries/he1", {
      call_status: "DNS",
    });
    await markDns("he1", false);
    expect(apiClient.patch).toHaveBeenLastCalledWith("/heat-entries/he1", {
      call_status: "WAITING",
    });
  });
});
