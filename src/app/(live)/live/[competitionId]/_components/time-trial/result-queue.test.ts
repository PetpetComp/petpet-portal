import { describe, expect, it } from "vitest";
import { RecordTimerResultError } from "@/domains/timetrial/api";
import { ApiError } from "@/lib/api-client";
import {
  resultFailurePatch,
  resultQueueReducer,
  waitingResultCount,
  type PendingResult,
} from "./result-queue";

function item(id: string, over: Partial<PendingResult> = {}): PendingResult {
  return {
    clientRequestId: id,
    attemptId: "a1",
    entryId: "e1",
    petName: "Niko",
    attemptLabel: 1,
    rawDurationMs: 38412,
    stopped: false,
    status: "sending",
    error: null,
    ...over,
  };
}

describe("resultQueueReducer", () => {
  it("adds, patches and removes by request id, never twice for the same tap", () => {
    let items = resultQueueReducer([], { type: "add", item: item("r1") });
    items = resultQueueReducer(items, {
      type: "add",
      item: item("r1", { rawDurationMs: 1 }),
    });
    expect(items).toHaveLength(1);
    items = resultQueueReducer(items, {
      type: "patch",
      clientRequestId: "r1",
      patch: { status: "waiting" },
    });
    expect(items[0].status).toBe("waiting");
    items = resultQueueReducer(items, {
      type: "remove",
      clientRequestId: "r1",
    });
    expect(items).toEqual([]);
  });

  it("clears everything", () => {
    const items = [item("r1"), item("r2")];
    expect(resultQueueReducer(items, { type: "clear" })).toEqual([]);
  });
});

describe("resultFailurePatch", () => {
  it("waits for a connection on a network error", () => {
    expect(resultFailurePatch(new ApiError(0, "Network down")).status).toBe(
      "waiting",
    );
    expect(resultFailurePatch(new ApiError(503, "Busy")).status).toBe(
      "waiting",
    );
  });

  it("rejects when the server refuses the time", () => {
    const patch = resultFailurePatch(new ApiError(422, "Too slow."));
    expect(patch.status).toBe("rejected");
    expect(patch.error).toBe("Too slow.");
  });

  it("marks the attempt as stopped when only the time was not saved", () => {
    const offline = new RecordTimerResultError(
      "a1",
      1000,
      "r1",
      new ApiError(0, "Network down"),
    );
    expect(resultFailurePatch(offline)).toMatchObject({
      stopped: true,
      status: "waiting",
    });
    const refused = new RecordTimerResultError(
      "a1",
      1000,
      "r1",
      new ApiError(409, "Conflict"),
    );
    expect(resultFailurePatch(refused)).toMatchObject({
      stopped: true,
      status: "rejected",
    });
  });
});

describe("waitingResultCount", () => {
  it("counts only the items waiting for a connection", () => {
    expect(
      waitingResultCount([
        item("r1", { status: "waiting" }),
        item("r2", { status: "sending" }),
        item("r3", { status: "rejected" }),
        item("r4", { status: "waiting" }),
      ]),
    ).toBe(2);
  });
});
