import { describe, expect, it } from "vitest";
import { AssignFinishError } from "@/domains/matches/api";
import type { FinishCapture } from "@/domains/matches/types";
import { ApiError } from "@/lib/api-client";
import {
  failurePatch,
  isRetryableError,
  nextOrderWithQueue,
  queueReducer,
  waitingCount,
  type PendingFinish,
} from "./finish-queue";

function item(over: Partial<PendingFinish> = {}): PendingFinish {
  return {
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
    ...over,
  };
}

const capture: FinishCapture = {
  id: "cap1",
  sessionId: "s1",
  finishOrder: 1,
  capturedTimeMs: 38412,
  assignedEntryId: null,
  assignmentStatus: "UNASSIGNED",
  capturedAt: "2026-10-11T08:00:00+00:00",
};

describe("queueReducer", () => {
  it("adds, patches and removes without touching the old array", () => {
    const empty: PendingFinish[] = [];
    const one = queueReducer(empty, { type: "add", item: item() });
    expect(empty).toHaveLength(0);
    expect(one).toHaveLength(1);
    const patched = queueReducer(one, {
      type: "patch",
      clientRequestId: "r1",
      patch: { status: "waiting" },
    });
    expect(patched[0].status).toBe("waiting");
    expect(one[0].status).toBe("sending");
    expect(
      queueReducer(patched, { type: "remove", clientRequestId: "r1" }),
    ).toEqual([]);
  });

  it("never holds the same clientRequestId twice", () => {
    let items = queueReducer([], { type: "add", item: item() });
    items = queueReducer(items, {
      type: "add",
      item: item({ status: "waiting" }),
    });
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("waiting");
  });

  it("clear empties the queue", () => {
    const items = [item(), item({ clientRequestId: "r2" })];
    expect(queueReducer(items, { type: "clear" })).toEqual([]);
  });
});

describe("failure classification", () => {
  it("treats network errors and unavailable servers as retryable", () => {
    expect(isRetryableError(new ApiError(0, "Network error"))).toBe(true);
    expect(isRetryableError(new ApiError(503, "Down"))).toBe(true);
    expect(isRetryableError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableError(new ApiError(409, "Conflict"))).toBe(false);
    expect(isRetryableError(new Error("Boom"))).toBe(false);
  });

  it("maps a network error to waiting", () => {
    expect(failurePatch(new ApiError(0, "Network error")).status).toBe(
      "waiting",
    );
  });

  it("maps AssignFinishError to unassigned and keeps the saved capture", () => {
    const patch = failurePatch(
      new AssignFinishError(capture, "e1", new ApiError(0, "Network error")),
    );
    expect(patch.status).toBe("unassigned");
    expect(patch.capture).toBe(capture);
  });

  it("maps a server refusal to rejected with its message", () => {
    const patch = failurePatch(new ApiError(409, "Session is not running."));
    expect(patch.status).toBe("rejected");
    expect(patch.error).toBe("Session is not running.");
  });
});

describe("queue helpers", () => {
  it("counts only the items waiting for the network", () => {
    const items = [
      item({ status: "waiting" }),
      item({ clientRequestId: "r2", status: "sending" }),
      item({ clientRequestId: "r3", status: "waiting" }),
    ];
    expect(waitingCount(items)).toBe(2);
  });

  it("numbers a new finish after both server captures and queued items of the same session", () => {
    const items = [
      item({ finishOrder: 4 }),
      item({ clientRequestId: "r2", sessionId: "other", finishOrder: 9 }),
    ];
    expect(nextOrderWithQueue([{ finishOrder: 2 }], items, "s1")).toBe(5);
    expect(nextOrderWithQueue([], [], "s1")).toBe(1);
  });
});
