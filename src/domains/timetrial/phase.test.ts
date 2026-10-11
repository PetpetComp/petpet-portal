import { describe, expect, it } from "vitest";
import {
  phaseOf,
  pendingResultAttempt,
  primaryActionOf,
  startAttemptLabel,
  type PhaseInput,
} from "./phase";
import type { Attempt, AttemptStatus, QueueItemActions } from "./types";

const attempt = (
  number: number,
  status: AttemptStatus,
  withResult = false,
): Attempt => ({
  id: `a${number}`,
  entryId: "e1",
  roundId: "r1",
  number,
  status,
  startedAt: null,
  stoppedAt: null,
  result: withResult
    ? {
        id: `t${number}`,
        attemptId: `a${number}`,
        rawDurationMs: 40000,
        penaltyMs: 0,
        finalDurationMs: 40000,
        finishStatus: "FINISHED",
        recordedAt: "x",
      }
    : null,
});

/** Masukan fase untuk peserta dengan attempt tertentu; `counted` default dihitung dari status. */
function input(
  attempts: Attempt[],
  over: Partial<PhaseInput> = {},
  counted = attempts.filter((a) =>
    ["FINISHED", "TIMEOUT", "DNF", "DSQ"].includes(a.status),
  ).length,
): PhaseInput {
  return {
    drawingLocked: true,
    finished: false,
    attemptLimit: 3,
    countdownActive: false,
    participant: {
      attempts,
      attemptsCounted: counted,
      activeAttempt:
        attempts.find(
          (a) => a.status === "WAITING" || a.status === "RUNNING",
        ) ?? null,
    },
    ...over,
  };
}

describe("phaseOf", () => {
  it("is NOT_DRAWN until the order is locked", () => {
    expect(phaseOf(input([], { drawingLocked: false }))).toBe("NOT_DRAWN");
  });

  it("is QUEUE_DONE when everyone is finished or nobody is on turn", () => {
    expect(phaseOf(input([], { finished: true }))).toBe("QUEUE_DONE");
    expect(phaseOf(input([], { participant: null }))).toBe("QUEUE_DONE");
  });

  it("is IDLE for a participant without a counted attempt, also after a false start", () => {
    expect(phaseOf(input([]))).toBe("IDLE");
    expect(phaseOf(input([attempt(1, "FALSE_START")]))).toBe("IDLE");
  });

  it("is COUNTDOWN while a WAITING attempt counts down on screen, READY otherwise", () => {
    const waiting = [attempt(1, "WAITING")];
    expect(phaseOf(input(waiting, { countdownActive: true }))).toBe(
      "COUNTDOWN",
    );
    expect(phaseOf(input(waiting, { countdownActive: false }))).toBe("READY");
  });

  it("is RUNNING while an attempt runs, even with the countdown flag still set", () => {
    expect(
      phaseOf(input([attempt(1, "RUNNING")], { countdownActive: true })),
    ).toBe("RUNNING");
  });

  it("is RESULT_PENDING when an attempt was stopped but its time is not saved", () => {
    expect(phaseOf(input([attempt(1, "FINISHED", false)]))).toBe(
      "RESULT_PENDING",
    );
  });

  it("is BETWEEN_ATTEMPTS while quota is left and QUOTA_USED when it is gone", () => {
    expect(phaseOf(input([attempt(1, "FINISHED", true)]))).toBe(
      "BETWEEN_ATTEMPTS",
    );
    expect(
      phaseOf(
        input([
          attempt(1, "FINISHED", true),
          attempt(2, "TIMEOUT"),
          attempt(3, "FINISHED", true),
        ]),
      ),
    ).toBe("QUOTA_USED");
  });

  it("does not use up the quota with retries", () => {
    expect(
      phaseOf(
        input([
          attempt(1, "FALSE_START"),
          attempt(2, "RETRY"),
          attempt(3, "FINISHED", true),
          attempt(4, "FALSE_START"),
        ]),
      ),
    ).toBe("BETWEEN_ATTEMPTS");
  });
});

describe("pendingResultAttempt", () => {
  it("finds a FINISHED attempt without a result", () => {
    expect(
      pendingResultAttempt([
        attempt(1, "FINISHED", true),
        attempt(2, "FINISHED"),
      ])?.number,
    ).toBe(2);
  });

  it("is null when every finished attempt has its time", () => {
    expect(pendingResultAttempt([attempt(1, "FINISHED", true)])).toBeNull();
    expect(pendingResultAttempt([attempt(1, "TIMEOUT")])).toBeNull();
  });
});

describe("primaryActionOf", () => {
  const flags = (over: Partial<QueueItemActions>): QueueItemActions => ({
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
    ...over,
  });

  it("offers Start attempt in IDLE and BETWEEN_ATTEMPTS only when the server allows it", () => {
    expect(primaryActionOf("IDLE", flags({ createAttempt: true }))).toBe(
      "START_ATTEMPT",
    );
    expect(
      primaryActionOf("BETWEEN_ATTEMPTS", flags({ createAttempt: true })),
    ).toBe("START_ATTEMPT");
    expect(primaryActionOf("IDLE", flags({}))).toBeNull();
  });

  it("offers Stop in RUNNING and start-now in READY", () => {
    expect(primaryActionOf("RUNNING", flags({ stop: true }))).toBe("STOP");
    expect(primaryActionOf("READY", flags({ start: true }))).toBe("START_NOW");
    expect(primaryActionOf("RUNNING", flags({}))).toBeNull();
  });

  it("offers Next participant when the quota is used", () => {
    expect(
      primaryActionOf("QUOTA_USED", flags({ nextParticipant: true })),
    ).toBe("NEXT_PARTICIPANT");
  });

  it("always offers a retry of the save in RESULT_PENDING", () => {
    expect(primaryActionOf("RESULT_PENDING", flags({}))).toBe("RETRY_RESULT");
  });

  it("offers nothing during the countdown, when not drawn or when the queue is done", () => {
    const all = flags({ createAttempt: true, stop: true, start: true });
    expect(primaryActionOf("COUNTDOWN", all)).toBeNull();
    expect(primaryActionOf("NOT_DRAWN", all)).toBeNull();
    expect(primaryActionOf("QUEUE_DONE", all)).toBeNull();
  });
});

describe("startAttemptLabel", () => {
  it("counts counted attempts, not physical numbers", () => {
    expect(startAttemptLabel(0)).toBe("Start attempt 1");
    expect(startAttemptLabel(1)).toBe("Start attempt 2");
    expect(startAttemptLabel(2)).toBe("Start attempt 3");
  });
});
