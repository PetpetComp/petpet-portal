import { describe, expect, it } from "vitest";
import type { Attempt } from "@/domains/timetrial/types";
import {
  attemptCircles,
  attemptResultText,
  countdownDigits,
  lastCountedAttempt,
  rankNote,
  statusText,
} from "./run-helpers";
import type { PendingResult } from "./result-queue";

/** Attempt seminimal untuk tes; `ms` mengisi timer result. */
function attempt(
  number: number,
  status: Attempt["status"],
  ms: number | null = null,
): Attempt {
  return {
    id: `a${number}`,
    entryId: "e1",
    roundId: "r1",
    number,
    status,
    startedAt: null,
    stoppedAt: null,
    result:
      ms === null
        ? null
        : {
            id: `t${number}`,
            attemptId: `a${number}`,
            rawDurationMs: ms,
            penaltyMs: 0,
            finalDurationMs: ms,
            finishStatus: "FINISHED",
            recordedAt: "2026-10-11T08:00:00+00:00",
          },
  };
}

const pendingResult = (status: PendingResult["status"]): PendingResult => ({
  clientRequestId: "req-1",
  attemptId: "a1",
  entryId: "e1",
  petName: "Niko",
  attemptLabel: 1,
  rawDurationMs: 1000,
  stopped: false,
  status,
  error: null,
});

describe("attemptCircles", () => {
  it("fills the counted attempts, outlines the next one and leaves the rest", () => {
    expect(attemptCircles(1, 3).map((c) => c.state)).toEqual([
      "done",
      "current",
      "remaining",
    ]);
    expect(attemptCircles(0, 2).map((c) => c.state)).toEqual([
      "current",
      "remaining",
    ]);
  });

  it("has no current circle once the quota is used", () => {
    expect(attemptCircles(3, 3).map((c) => c.state)).toEqual([
      "done",
      "done",
      "done",
    ]);
  });
});

describe("lastCountedAttempt", () => {
  it("ignores false starts and retries and reports the order among counted attempts", () => {
    const found = lastCountedAttempt([
      attempt(1, "FALSE_START"),
      attempt(2, "FINISHED", 44870),
      attempt(3, "RETRY"),
    ]);
    expect(found?.ordinal).toBe(1);
    expect(found?.attempt.number).toBe(2);
  });

  it("is null when nothing is counted", () => {
    expect(lastCountedAttempt([attempt(1, "FALSE_START")])).toBeNull();
  });
});

describe("attemptResultText", () => {
  it("shows the time, or the status when there is no valid time", () => {
    expect(attemptResultText(attempt(1, "FINISHED", 72540))).toBe("01:12.540");
    expect(attemptResultText(attempt(1, "TIMEOUT"))).toBe("Timeout");
    expect(attemptResultText(attempt(1, "FINISHED"))).toBe("Not saved");
  });
});

describe("rankNote", () => {
  const ranked = { bestRank: 2, bestTimeMs: 38412, bestAttemptNumber: 2 };

  it("says New best time when the last attempt is the best one", () => {
    expect(rankNote(ranked, attempt(2, "FINISHED", 38412))).toBe(
      "New best time 00:38.412 - rank 2",
    );
  });

  it("says Best time when an earlier attempt is still the best", () => {
    expect(rankNote(ranked, attempt(3, "FINISHED", 50000))).toBe(
      "Best time 00:38.412 - rank 2",
    );
  });

  it("is null without a valid time", () => {
    expect(
      rankNote(
        { bestRank: null, bestTimeMs: null, bestAttemptNumber: null },
        attempt(1, "TIMEOUT"),
      ),
    ).toBeNull();
  });
});

describe("statusText", () => {
  const base = {
    phase: "IDLE" as const,
    starting: false,
    pending: null,
    countdownSeconds: 3,
    counted: 0,
    last: null,
  };

  it("describes the countdown rule before the start", () => {
    expect(countdownDigits(3)).toBe("3-2-1");
    expect(statusText(base)).toBe("Ready - countdown 3-2-1 is on");
    expect(statusText({ ...base, countdownSeconds: 0 })).toBe("Ready");
  });

  it("prefers the pending result over the phase", () => {
    expect(
      statusText({
        ...base,
        phase: "RUNNING",
        pending: pendingResult("waiting"),
      }),
    ).toBe("Pending - waiting for a connection");
    expect(
      statusText({
        ...base,
        phase: "RUNNING",
        pending: pendingResult("sending"),
      }),
    ).toBe("Saving the time...");
  });

  it("describes the running, countdown and between-attempts phases", () => {
    expect(statusText({ ...base, phase: "COUNTDOWN" })).toBe("Get ready");
    expect(statusText({ ...base, phase: "RUNNING" })).toBe("Running");
    expect(statusText({ ...base, phase: "RUNNING", starting: true })).toBe(
      "Starting...",
    );
    expect(
      statusText({
        ...base,
        phase: "BETWEEN_ATTEMPTS",
        counted: 1,
        last: attempt(1, "TIMEOUT"),
      }),
    ).toBe("Cut-off reached - attempt 1 counted");
  });
});
