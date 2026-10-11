import { describe, expect, it } from "vitest";
import type { AttemptFacts } from "./attempts";
import {
  currentEntryOf,
  effectiveOrder,
  isTerminalState,
  participantActions,
  queueStateOf,
  withSkipped,
  type ParticipantRuleInput,
} from "./rules";
import type { AttemptStatus, QueueItemActions } from "./types";

const at = (
  number: number,
  status: AttemptStatus,
  finalDurationMs: number | null = null,
): AttemptFacts => ({ number, status, finalDurationMs, stoppedAt: null });

/** Peserta yang sedang giliran, kompetisi terbuka, pemanggil boleh semuanya, jatah 3. */
const input = (
  over: Partial<ParticipantRuleInput> = {},
): ParticipantRuleInput => ({
  state: "NOT_STARTED",
  disqualified: false,
  attempts: [],
  attemptLimit: 3,
  isCurrent: true,
  otherActive: false,
  hasOthersWaiting: true,
  open: true,
  runner: true,
  penalizer: true,
  ...over,
});

/** Nama flag yang true, supaya tes mudah dibaca. */
const allowed = (actions: QueueItemActions) =>
  (Object.keys(actions) as (keyof QueueItemActions)[]).filter(
    (key) => actions[key],
  );

describe("queueStateOf", () => {
  it("maps round entry statuses to queue states", () => {
    expect(queueStateOf("WAITING", false)).toBe("NOT_STARTED");
    expect(queueStateOf("CALLED", false)).toBe("NOT_STARTED");
    expect(queueStateOf("IN_PROGRESS", false)).toBe("IN_PROGRESS");
    expect(queueStateOf("JUDGING", false)).toBe("IN_PROGRESS");
    expect(queueStateOf("COMPLETED", false)).toBe("DONE");
    expect(queueStateOf("DNS", false)).toBe("DNS");
    expect(queueStateOf("DSQ", false)).toBe("DQ");
  });

  it("lets an active disqualification win over everything", () => {
    expect(queueStateOf("COMPLETED", true)).toBe("DQ");
    expect(queueStateOf("WAITING", true)).toBe("DQ");
  });

  it("knows the terminal states", () => {
    expect(isTerminalState("DONE")).toBe(true);
    expect(isTerminalState("DNS")).toBe(true);
    expect(isTerminalState("DQ")).toBe(true);
    expect(isTerminalState("NOT_STARTED")).toBe(false);
    expect(isTerminalState("IN_PROGRESS")).toBe(false);
  });
});

describe("effectiveOrder and withSkipped", () => {
  it("is the drawn order without skips", () => {
    expect(effectiveOrder(["a", "b", "c"], [])).toEqual(["a", "b", "c"]);
  });

  it("moves a skipped participant to the end", () => {
    expect(effectiveOrder(["a", "b", "c", "d"], ["b"])).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("keeps the skip order for several skips", () => {
    expect(effectiveOrder(["a", "b", "c", "d"], ["b", "a"])).toEqual([
      "c",
      "d",
      "b",
      "a",
    ]);
  });

  it("ignores skipped ids that are not drawn", () => {
    expect(effectiveOrder(["a", "b"], ["zzz"])).toEqual(["a", "b"]);
  });

  it("re-skipping moves the participant to the very end again, never twice", () => {
    let skipped = withSkipped([], "b");
    skipped = withSkipped(skipped, "a");
    skipped = withSkipped(skipped, "b");
    expect(skipped).toEqual(["a", "b"]);
    expect(withSkipped(["a"], "a")).toEqual(["a"]);
    expect(effectiveOrder(["a", "b", "c"], skipped)).toEqual(["c", "a", "b"]);
  });
});

describe("currentEntryOf", () => {
  const p = (
    entryId: string,
    state: Parameters<typeof isTerminalState>[0],
    hasActiveAttempt = false,
  ) => ({ entryId, state, hasActiveAttempt });

  it("is the first participant that is not done, DNS or DQ", () => {
    expect(
      currentEntryOf([p("a", "DONE"), p("b", "DNS"), p("c", "NOT_STARTED")]),
    ).toBe("c");
    expect(
      currentEntryOf([
        p("a", "DQ"),
        p("b", "IN_PROGRESS"),
        p("c", "NOT_STARTED"),
      ]),
    ).toBe("b");
  });

  it("lets the holder of an active attempt win even when it is not first", () => {
    expect(
      currentEntryOf([p("a", "NOT_STARTED"), p("b", "IN_PROGRESS", true)]),
    ).toBe("b");
  });

  it("is null when everyone is finished or the queue is empty", () => {
    expect(currentEntryOf([p("a", "DONE"), p("b", "DNS")])).toBeNull();
    expect(currentEntryOf([])).toBeNull();
  });
});

describe("participantActions: the first attempt", () => {
  it("lets the participant on turn create an attempt, be skipped, did not start, disqualified", () => {
    expect(allowed(participantActions(input()))).toEqual([
      "createAttempt",
      "skip",
      "markDns",
      "disqualify",
    ]);
  });

  it("offers start and retry (not create) while an attempt is WAITING", () => {
    const actions = participantActions(input({ attempts: [at(1, "WAITING")] }));
    expect(allowed(actions)).toEqual(["start", "retry", "disqualify"]);
  });

  it("offers stop and retry while an attempt is RUNNING", () => {
    const actions = participantActions(
      input({ state: "IN_PROGRESS", attempts: [at(1, "RUNNING")] }),
    );
    expect(allowed(actions)).toEqual(["stop", "retry", "disqualify"]);
  });
});

describe("participantActions: between attempts (decision 3A)", () => {
  it("after a finished attempt offers another attempt, next participant and undo", () => {
    const actions = participantActions(
      input({ state: "IN_PROGRESS", attempts: [at(1, "FINISHED", 40000)] }),
    );
    expect(allowed(actions)).toEqual([
      "createAttempt",
      "undo",
      "nextParticipant",
      "disqualify",
    ]);
  });

  it("a false start does not use an attempt: still skippable and no Next participant", () => {
    const actions = participantActions(
      input({ state: "IN_PROGRESS", attempts: [at(1, "FALSE_START")] }),
    );
    expect(actions.createAttempt).toBe(true);
    expect(actions.skip).toBe(true);
    expect(actions.markDns).toBe(true);
    expect(actions.nextParticipant).toBe(false);
    expect(actions.undo).toBe(false);
  });

  it("with the quota used (3 counted) only next participant and undo remain", () => {
    const actions = participantActions(
      input({
        state: "IN_PROGRESS",
        attempts: [
          at(1, "FINISHED", 41000),
          at(2, "TIMEOUT"),
          at(3, "FINISHED", 39000),
        ],
      }),
    );
    expect(actions.createAttempt).toBe(false);
    expect(actions.nextParticipant).toBe(true);
    expect(actions.undo).toBe(true);
  });

  it("retries do not eat the quota: 3 retries and 2 counted still leave one attempt", () => {
    const actions = participantActions(
      input({
        state: "IN_PROGRESS",
        attempts: [
          at(1, "RETRY"),
          at(2, "FINISHED", 41000),
          at(3, "FALSE_START"),
          at(4, "FINISHED", 40000),
          at(5, "RETRY"),
        ],
      }),
    );
    expect(actions.createAttempt).toBe(true);
  });

  it("blocks create and next participant while a finished attempt has no saved time", () => {
    const actions = participantActions(
      input({ state: "IN_PROGRESS", attempts: [at(1, "FINISHED", null)] }),
    );
    expect(actions.createAttempt).toBe(false);
    expect(actions.nextParticipant).toBe(false);
    expect(actions.undo).toBe(true);
  });

  it("does not allow skip when it is pointless (nobody else waiting)", () => {
    expect(participantActions(input({ hasOthersWaiting: false })).skip).toBe(
      false,
    );
  });
});

describe("participantActions: one running attempt per competition", () => {
  it("blocks create and start when another participant holds an active attempt", () => {
    expect(participantActions(input({ otherActive: true })).createAttempt).toBe(
      false,
    );
    expect(
      participantActions(
        input({ otherActive: true, attempts: [at(1, "WAITING")] }),
      ).start,
    ).toBe(false);
  });
});

describe("participantActions: turn, state and caller", () => {
  it("allows running actions only for the participant on turn", () => {
    const actions = participantActions(input({ isCurrent: false }));
    expect(actions).toMatchObject({
      createAttempt: false,
      skip: false,
      markDns: false,
      nextParticipant: false,
    });
    // But a disqualification does not need the turn once the participant has attempts.
    expect(
      participantActions(
        input({
          isCurrent: false,
          state: "IN_PROGRESS",
          attempts: [at(1, "FINISHED", 1)],
        }),
      ).disqualify,
    ).toBe(true);
    expect(participantActions(input({ isCurrent: false })).disqualify).toBe(
      false,
    );
  });

  it("offers undo DNS and nothing else for a participant who did not start", () => {
    const actions = participantActions(
      input({ state: "DNS", isCurrent: false }),
    );
    expect(allowed(actions)).toEqual(["undoDns"]);
  });

  it("offers reopen for a done participant, regardless of turn", () => {
    const actions = participantActions(
      input({
        state: "DONE",
        isCurrent: false,
        attempts: [at(1, "FINISHED", 1)],
      }),
    );
    expect(allowed(actions)).toEqual(["disqualify", "reopen"]);
  });

  it("offers only undo disqualify for a disqualified participant", () => {
    const actions = participantActions(
      input({
        state: "DQ",
        disqualified: true,
        attempts: [at(1, "FINISHED", 1)],
      }),
    );
    expect(allowed(actions)).toEqual(["undoDisqualify"]);
  });

  it("allows nothing when the competition is closed to running", () => {
    expect(allowed(participantActions(input({ open: false })))).toEqual([]);
  });

  it("separates the runner right from the penalty right", () => {
    expect(allowed(participantActions(input({ runner: false })))).toEqual([
      "disqualify",
    ]);
    expect(allowed(participantActions(input({ penalizer: false })))).toEqual([
      "createAttempt",
      "skip",
      "markDns",
    ]);
    expect(
      allowed(participantActions(input({ runner: false, penalizer: false }))),
    ).toEqual([]);
  });
});
