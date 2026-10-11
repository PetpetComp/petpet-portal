import { describe, expect, it } from "vitest";
import {
  attemptFromApi,
  fromApi,
  participantFromApi,
  timerResultFromApi,
  type ApiAttempt,
  type ApiQueue,
  type ApiQueueItem,
  type ApiQueueItemActions,
} from "./types";

const noActions: ApiQueueItemActions = {
  create_attempt: false,
  start: false,
  stop: false,
  retry: false,
  undo: false,
  next_participant: false,
  skip: false,
  mark_dns: false,
  undo_dns: false,
  disqualify: false,
  undo_disqualify: false,
  reopen: false,
};

const apiAttempt = (over: Partial<ApiAttempt> = {}): ApiAttempt => ({
  uuid: "a1",
  entry_uuid: "e1",
  round_uuid: "round-1",
  heat_uuid: null,
  attempt_number: 1,
  started_at: "2026-10-11T08:00:00+00:00",
  stopped_at: "2026-10-11T08:00:38+00:00",
  status: "FINISHED",
  timer_result: {
    uuid: "tr1",
    attempt_uuid: "a1",
    raw_duration_ms: 38412,
    penalty_ms: 500,
    final_duration_ms: 38912,
    finish_status: "FINISHED",
    recorded_by_uuid: "u1",
    recorded_at: "2026-10-11T08:00:39+00:00",
  },
  checkpoint_results: [],
  ...over,
});

const apiItem = (over: Partial<ApiQueueItem> = {}): ApiQueueItem => ({
  round_entry_uuid: "re-e1",
  entry_uuid: "e1",
  drawing_order: 1,
  queue_number: 1,
  queue_position: 1,
  status: "IN_PROGRESS",
  state: "IN_PROGRESS",
  pet_name: "Mika",
  pet_morph_name: "Cremino",
  owner_name: "Citra Permana",
  bib_number: "109",
  attempts: [apiAttempt()],
  attempts_counted: 1,
  best_time_ms: 38912,
  best_attempt_number: 1,
  best_rank: 1,
  penalties: [],
  actions: { ...noActions, create_attempt: true },
  ...over,
});

const apiQueue = (over: Partial<ApiQueue> = {}): ApiQueue => ({
  competition_uuid: "c1",
  round_uuid: "round-1",
  drawing_status: "LOCKED",
  rules: {
    attempt_limit: 3,
    cutoff_ms: 120000,
    countdown_seconds: 3,
    ranking_rule: ["TIME_ASC"],
  },
  current_entry_uuid: "e1",
  items: [apiItem()],
  summary: {
    total: 1,
    not_started: 0,
    in_progress: 1,
    done: 0,
    dns: 0,
    dq: 0,
  },
  ...over,
});

describe("timer result and attempt mappers", () => {
  it("maps the timer result with raw, penalty and final time", () => {
    const result = timerResultFromApi(apiAttempt().timer_result!);
    expect(result).toEqual({
      id: "tr1",
      attemptId: "a1",
      rawDurationMs: 38412,
      penaltyMs: 500,
      finalDurationMs: 38912,
      finishStatus: "FINISHED",
      recordedAt: "2026-10-11T08:00:39+00:00",
    });
  });

  it("maps an attempt with and without a result", () => {
    expect(attemptFromApi(apiAttempt())).toMatchObject({
      id: "a1",
      entryId: "e1",
      roundId: "round-1",
      number: 1,
      status: "FINISHED",
      result: { finalDurationMs: 38912 },
    });
    expect(
      attemptFromApi(apiAttempt({ status: "WAITING", timer_result: null }))
        .result,
    ).toBeNull();
  });
});

describe("participantFromApi", () => {
  it("sorts attempts by number and finds the active one", () => {
    const participant = participantFromApi(
      apiItem({
        attempts: [
          apiAttempt({
            uuid: "a2",
            attempt_number: 2,
            status: "RUNNING",
            timer_result: null,
          }),
          apiAttempt({ uuid: "a1", attempt_number: 1 }),
        ],
      }),
    );
    expect(participant.attempts.map((a) => a.number)).toEqual([1, 2]);
    expect(participant.activeAttempt?.id).toBe("a2");
  });

  it("has no active attempt when every attempt is closed", () => {
    expect(participantFromApi(apiItem()).activeAttempt).toBeNull();
  });

  it("fills blank names and the bib", () => {
    const participant = participantFromApi(
      apiItem({ pet_name: null, pet_morph_name: null, bib_number: null }),
    );
    expect(participant).toMatchObject({
      petName: "Unnamed pet",
      petMorphName: "",
      bibNumber: "",
    });
  });

  it("reads the active disqualification from penalties", () => {
    const penalty = (uuid: string, status: "ACTIVE" | "REVOKED") => ({
      uuid,
      entry_uuid: "e1",
      attempt_uuid: null,
      penalty_type: "DISQUALIFICATION",
      penalty_value: "0.00",
      penalty_unit: "DISQUALIFICATION" as const,
      reason: "False start",
      issued_by_uuid: "u1",
      issued_at: "2026-10-11T08:00:00+00:00",
      status,
    });
    const participant = participantFromApi(
      apiItem({
        penalties: [penalty("p1", "REVOKED"), penalty("p2", "ACTIVE")],
      }),
    );
    expect(participant.penalties).toHaveLength(2);
    expect(participant.disqualification?.id).toBe("p2");
    expect(
      participantFromApi(apiItem({ penalties: [penalty("p1", "REVOKED")] }))
        .disqualification,
    ).toBeNull();
  });

  it("maps every action flag to camelCase", () => {
    const flags = Object.fromEntries(
      Object.keys(noActions).map((key) => [key, true]),
    ) as ApiQueueItemActions;
    const actions = participantFromApi(apiItem({ actions: flags })).actions;
    expect(Object.values(actions).every((value) => value === true)).toBe(true);
    expect(Object.keys(actions)).toEqual([
      "createAttempt",
      "start",
      "stop",
      "retry",
      "undo",
      "nextParticipant",
      "skip",
      "markDns",
      "undoDns",
      "disqualify",
      "undoDisqualify",
      "reopen",
    ]);
  });

  it("keeps the server-owned counts and ranking", () => {
    expect(participantFromApi(apiItem())).toMatchObject({
      attemptsCounted: 1,
      bestTimeMs: 38912,
      bestAttemptNumber: 1,
      bestRank: 1,
      drawingOrder: 1,
      queueNumber: 1,
      queuePosition: 1,
    });
  });
});

describe("queue fromApi", () => {
  it("maps rules, lock state and orders participants by queue position", () => {
    const queue = fromApi(
      apiQueue({
        items: [
          apiItem({ entry_uuid: "e2", queue_position: 2 }),
          apiItem({ entry_uuid: "e1", queue_position: 1 }),
        ],
        summary: {
          total: 2,
          not_started: 1,
          in_progress: 1,
          done: 0,
          dns: 0,
          dq: 0,
        },
      }),
    );
    expect(queue.drawingLocked).toBe(true);
    expect(queue.roundId).toBe("round-1");
    expect(queue.rules).toEqual({
      attemptLimit: 3,
      cutoffMs: 120000,
      countdownSeconds: 3,
      rankingRule: ["TIME_ASC"],
    });
    expect(queue.participants.map((p) => p.entryId)).toEqual(["e1", "e2"]);
    expect(queue.currentEntryId).toBe("e1");
    expect(queue.finished).toBe(false);
  });

  it("reads NOT_DRAWN as not locked and empty, never finished", () => {
    const queue = fromApi(
      apiQueue({
        drawing_status: "NOT_DRAWN",
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
    expect(queue.drawingLocked).toBe(false);
    expect(queue.participants).toEqual([]);
    expect(queue.finished).toBe(false);
  });

  it("is finished once nobody is waiting or in progress", () => {
    const queue = fromApi(
      apiQueue({
        current_entry_uuid: null,
        summary: {
          total: 3,
          not_started: 0,
          in_progress: 0,
          done: 1,
          dns: 1,
          dq: 1,
        },
      }),
    );
    expect(queue.finished).toBe(true);
    expect(queue.summary).toEqual({
      total: 3,
      notStarted: 0,
      inProgress: 0,
      done: 1,
      dns: 1,
      dq: 1,
    });
  });
});
