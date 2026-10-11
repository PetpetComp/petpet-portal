import { describe, expect, it } from "vitest";
import {
  activeAttempt,
  attemptFacts,
  attemptFactsFromApi,
  attemptsRemaining,
  bestAttemptOf,
  countedAttempts,
  isActiveStatus,
  isCountedStatus,
  latestCountedAttempt,
  nextAttemptLabel,
  nextAttemptNumber,
  validTimeOf,
  type AttemptFacts,
} from "./attempts";
import type { Attempt, ApiAttempt, AttemptStatus } from "./types";

/** Satu attempt dengan nomor, status, waktu resmi (null = belum ada), dan saat berhenti. */
const at = (
  number: number,
  status: AttemptStatus,
  finalDurationMs: number | null = null,
  stoppedAt: string | null = null,
): AttemptFacts => ({ number, status, finalDurationMs, stoppedAt });

describe("counted statuses (decision 3A)", () => {
  it("counts FINISHED, TIMEOUT, DNF and DSQ", () => {
    for (const status of ["FINISHED", "TIMEOUT", "DNF", "DSQ"] as const)
      expect(isCountedStatus(status)).toBe(true);
  });

  it("does not count a retry, a false start or an attempt still in play", () => {
    for (const status of [
      "RETRY",
      "FALSE_START",
      "WAITING",
      "RUNNING",
    ] as const)
      expect(isCountedStatus(status)).toBe(false);
  });

  it("knows which attempts are active", () => {
    expect(isActiveStatus("WAITING")).toBe(true);
    expect(isActiveStatus("RUNNING")).toBe(true);
    expect(isActiveStatus("FINISHED")).toBe(false);
  });
});

describe("countedAttempts and attemptsRemaining", () => {
  it("does not count a false start or a retry", () => {
    const attempts = [
      at(1, "FALSE_START"),
      at(2, "FINISHED", 40000),
      at(3, "RETRY"),
      at(4, "TIMEOUT"),
    ];
    expect(countedAttempts(attempts)).toBe(2);
  });

  it("returns what is left and never goes below zero", () => {
    expect(attemptsRemaining(3, 1)).toBe(2);
    expect(attemptsRemaining(3, 3)).toBe(0);
    expect(attemptsRemaining(3, 5)).toBe(0);
  });
});

describe("nextAttemptNumber and the label", () => {
  it("is 1 for a participant without attempts", () => {
    expect(nextAttemptNumber([])).toBe(1);
  });

  it("keeps counting after a retry: the physical number jumps, the label does not", () => {
    const attempts = [at(1, "FALSE_START"), at(2, "FINISHED", 40000)];
    expect(nextAttemptNumber(attempts)).toBe(3);
    expect(nextAttemptLabel(countedAttempts(attempts))).toBe(2);
  });

  it("uses the highest number even when the list is unordered", () => {
    expect(nextAttemptNumber([at(3, "RETRY"), at(1, "FINISHED", 1)])).toBe(4);
  });
});

describe("activeAttempt and latestCountedAttempt", () => {
  it("finds the waiting or running attempt", () => {
    expect(
      activeAttempt([at(1, "FINISHED", 1), at(2, "RUNNING")])?.number,
    ).toBe(2);
    expect(activeAttempt([at(1, "WAITING")])?.number).toBe(1);
    expect(activeAttempt([at(1, "FINISHED", 1)])).toBeNull();
  });

  it("returns the highest counted attempt, skipping retries", () => {
    const attempts = [
      at(1, "FINISHED", 41000),
      at(2, "TIMEOUT"),
      at(3, "RETRY"),
    ];
    expect(latestCountedAttempt(attempts)?.number).toBe(2);
    expect(latestCountedAttempt([at(1, "FALSE_START")])).toBeNull();
    expect(latestCountedAttempt([])).toBeNull();
  });
});

describe("validTimeOf", () => {
  it("is the final time of a FINISHED attempt", () => {
    expect(validTimeOf(at(1, "FINISHED", 38912))).toBe(38912);
  });

  it("is null without a recorded result", () => {
    expect(validTimeOf(at(1, "FINISHED", null))).toBeNull();
  });

  it("is null for every status that is not FINISHED, even with a time", () => {
    for (const status of [
      "TIMEOUT",
      "DNF",
      "DSQ",
      "RETRY",
      "FALSE_START",
    ] as const)
      expect(validTimeOf(at(1, status, 30000))).toBeNull();
  });
});

describe("bestAttemptOf", () => {
  it("picks the fastest valid attempt", () => {
    const best = bestAttemptOf([
      at(1, "FINISHED", 41230, "2026-10-11T08:05:00+00:00"),
      at(2, "FINISHED", 38412, "2026-10-11T08:07:00+00:00"),
      at(3, "TIMEOUT"),
    ]);
    expect(best).toEqual({
      number: 2,
      timeMs: 38412,
      stoppedAt: "2026-10-11T08:07:00+00:00",
    });
  });

  it("uses the final time, so a penalty can change which attempt is best", () => {
    // Attempt 1 raw 38000 + 5000 penalty = 43000 (already in finalDurationMs); attempt 2 is 41000.
    const best = bestAttemptOf([
      at(1, "FINISHED", 43000),
      at(2, "FINISHED", 41000),
    ]);
    expect(best?.number).toBe(2);
  });

  it("ignores retries, false starts and attempts without a result", () => {
    expect(
      bestAttemptOf([
        at(1, "FALSE_START", 10),
        at(2, "RETRY", 10),
        at(3, "FINISHED", null),
        at(4, "DNF"),
      ]),
    ).toBeNull();
  });

  it("is null without attempts", () => {
    expect(bestAttemptOf([])).toBeNull();
  });

  it("breaks an equal time by the earlier stop, then by the lower number", () => {
    expect(
      bestAttemptOf([
        at(1, "FINISHED", 40000, "2026-10-11T08:09:00+00:00"),
        at(2, "FINISHED", 40000, "2026-10-11T08:05:00+00:00"),
      ])?.number,
    ).toBe(2);
    expect(
      bestAttemptOf([
        at(2, "FINISHED", 40000, null),
        at(1, "FINISHED", 40000, null),
      ])?.number,
    ).toBe(1);
    // A known stop moment beats an unknown one.
    expect(
      bestAttemptOf([
        at(1, "FINISHED", 40000, null),
        at(2, "FINISHED", 40000, "2026-10-11T08:05:00+00:00"),
      ])?.number,
    ).toBe(2);
  });
});

describe("facts mappers", () => {
  it("reads the final time from an API attempt", () => {
    const api = {
      uuid: "a1",
      entry_uuid: "e1",
      round_uuid: "r1",
      heat_uuid: null,
      attempt_number: 2,
      started_at: null,
      stopped_at: "2026-10-11T08:00:38+00:00",
      status: "FINISHED",
      timer_result: {
        uuid: "t1",
        attempt_uuid: "a1",
        raw_duration_ms: 1000,
        penalty_ms: 250,
        final_duration_ms: 1250,
        finish_status: "FINISHED",
        recorded_by_uuid: "u1",
        recorded_at: "x",
      },
      checkpoint_results: [],
    } satisfies ApiAttempt;
    expect(attemptFactsFromApi(api)).toEqual({
      number: 2,
      status: "FINISHED",
      finalDurationMs: 1250,
      stoppedAt: "2026-10-11T08:00:38+00:00",
    });
    expect(
      attemptFactsFromApi({ ...api, timer_result: null }).finalDurationMs,
    ).toBeNull();
  });

  it("reads the final time from a screen attempt", () => {
    const screen: Attempt = {
      id: "a1",
      entryId: "e1",
      roundId: "r1",
      number: 1,
      status: "FINISHED",
      startedAt: null,
      stoppedAt: null,
      result: {
        id: "t1",
        attemptId: "a1",
        rawDurationMs: 900,
        penaltyMs: 100,
        finalDurationMs: 1000,
        finishStatus: "FINISHED",
        recordedAt: "x",
      },
    };
    expect(attemptFacts(screen).finalDurationMs).toBe(1000);
    expect(
      attemptFacts({ ...screen, result: null }).finalDurationMs,
    ).toBeNull();
  });
});
