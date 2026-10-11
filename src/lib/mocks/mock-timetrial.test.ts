import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { lockBody } from "@/domains/drawing/api";
import { buildQueue } from "@/domains/drawing/draw";
import type { ApiDrawing } from "@/domains/drawing/types";
import type { ApiPenalty } from "@/domains/matches/types";
import type {
  ApiAttempt,
  ApiQueue,
  ApiQueueItem,
  ApiRoundEntry,
  ApiTimerResult,
} from "@/domains/timetrial/types";
import {
  drawingStore,
  eligibleEntries,
  seedTimeTrialOrder,
} from "./mock-drawing";
import { mockRequest } from "./mock-request";
import { resetStaffStore, staffStore } from "./mock-staff";
import { DEMO_PASSWORD, store } from "./mock-store";
import { resetTimetrialStore, timetrialStore } from "./mock-timetrial";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk sama dengan kontrak Time trial (14). */
const TRIAL = "comp-glider-time-trial"; // TIME_TRIAL, SCHEDULED, registrasi tutup, BELUM di-lock (6 peserta)
const SPEED = "comp-glider-speed-trial"; // TIME_TRIAL, ONGOING, SUDAH di-lock dan sudah jalan (4 peserta)
const SPRINT = "comp-glider-sprint-heats"; // Race, SUDAH di-lock
const BEAUTY = "comp-beauty-class-open"; // bukan Race atau Time trial
const JAKARTA = "evt-jakarta-pet-festival";
const roundOf = (competition: string) => `round-${competition}-1`;

async function call<T>(
  method: string,
  url: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return (await mockRequest<{ data: T }>(method, url, body)).data;
}
const signIn = (email: string) =>
  call("POST", "/auth/login", { email, password: DEMO_PASSWORD });
const asOrganizer = () => signIn("organizer@petpet.dev");
const asCompetitor = () => signIn("competitor@petpet.dev");

const queue = (competition: string) =>
  call<ApiQueue>("GET", `/competitions/${competition}/queue`);
const itemOf = (data: ApiQueue, entry: string): ApiQueueItem => {
  const found = data.items.find((i) => i.entry_uuid === entry);
  if (!found) throw new Error(`no queue item for ${entry}`);
  return found;
};
const orderOf = (data: ApiQueue) => data.items.map((i) => i.entry_uuid);

const createAttempt = (
  competition: string,
  entry: string,
  number: number,
  extra: Record<string, unknown> = {},
) =>
  call<ApiAttempt>("POST", `/rounds/${roundOf(competition)}/attempts`, {
    entry_id: entry,
    attempt_number: number,
    ...extra,
  });
const startAttempt = (id: string) =>
  call<ApiAttempt>("POST", `/attempts/${id}/start`);
const stopAttempt = (id: string) =>
  call<ApiAttempt>("POST", `/attempts/${id}/stop`);
const recordResult = (
  id: string,
  raw: number,
  extra: Record<string, unknown> = {},
) =>
  call<ApiTimerResult>("POST", `/attempts/${id}/timer-result`, {
    raw_duration_ms: raw,
    finish_status: "FINISHED",
    ...extra,
  });
const setStatus = (id: string, status: string) =>
  call<ApiAttempt>("PATCH", `/attempts/${id}/status`, { status });
const patchEntry = (entry: string, body: Record<string, unknown>) =>
  call<ApiRoundEntry>("PATCH", `/round-entries/re-${entry}`, body);
const skip = (competition: string, entry: string) =>
  call<ApiQueue>("POST", `/competitions/${competition}/queue/${entry}/skip`);
const disqualify = (entry: string, reason = "False start") =>
  call<ApiPenalty>("POST", `/entries/${entry}/penalties`, {
    penalty_type: "DISQUALIFICATION",
    penalty_value: 0,
    penalty_unit: "DISQUALIFICATION",
    reason,
  });
const revoke = (penalty: string) =>
  call<ApiPenalty>("POST", `/penalties/${penalty}/revoke`);

/** Mengunci undian TRIAL dan mengembalikan urutan antreannya (entry uuid, posisi 1..6). */
async function lockTrial(): Promise<string[]> {
  const order = buildQueue(
    eligibleEntries(TRIAL).map((e) => e.uuid),
    1,
  );
  await call<ApiDrawing>(
    "POST",
    `/competitions/${TRIAL}/drawing`,
    lockBody(order),
  );
  return order[0];
}

/** Satu percobaan penuh seperti satu ketukan di layar: buat, mulai, stop, simpan waktu. */
async function runAttempt(
  competition: string,
  entry: string,
  number: number,
  ms: number,
  extra: Record<string, unknown> = {},
) {
  const attempt = await createAttempt(competition, entry, number);
  await startAttempt(attempt.uuid);
  await stopAttempt(attempt.uuid);
  await recordResult(attempt.uuid, ms, extra);
  return attempt.uuid;
}

beforeAll(() => {
  // Jam tetap setelah waktu seed, supaya "tercapai lebih dulu" bisa diuji.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
});
afterAll(() => vi.useRealTimers());

// Tes mengubah kompetisi, entry, staf, dan data time trial: kembalikan setelah tiap tes.
const seedCompetitions = structuredClone(store.competitions);
const seedEntriesCopy = structuredClone(store.entries);
afterEach(() => {
  store.competitions = structuredClone(seedCompetitions);
  store.entries = structuredClone(seedEntriesCopy);
  resetStaffStore();
  resetTimetrialStore();
});

describe("seed and reading", () => {
  it("has an undrawn time trial with the rules of the demo (3 attempts, cut-off 2 min, 3 s countdown)", async () => {
    await asOrganizer();
    const data = await queue(TRIAL);
    expect(data).toMatchObject({
      competition_uuid: TRIAL,
      round_uuid: roundOf(TRIAL),
      drawing_status: "NOT_DRAWN",
      current_entry_uuid: null,
      items: [],
      rules: {
        attempt_limit: 3,
        cutoff_ms: 120000,
        countdown_seconds: 3,
        ranking_rule: ["TIME_ASC"],
      },
      summary: {
        total: 0,
        not_started: 0,
        in_progress: 0,
        done: 0,
        dns: 0,
        dq: 0,
      },
    });
  });

  it("has a running time trial: one done pet, one in progress, two waiting", async () => {
    await asOrganizer();
    const data = await queue(SPEED);
    const [first, second, third, fourth] = seedTimeTrialOrder();
    expect(orderOf(data)).toEqual([first, second, third, fourth]);
    expect(data.drawing_status).toBe("LOCKED");
    expect(data.current_entry_uuid).toBe(second);
    expect(data.summary).toEqual({
      total: 4,
      not_started: 2,
      in_progress: 1,
      done: 1,
      dns: 0,
      dq: 0,
    });
    expect(itemOf(data, first)).toMatchObject({
      state: "DONE",
      status: "COMPLETED",
      attempts_counted: 2,
      best_time_ms: 38412,
      best_attempt_number: 2,
      best_rank: 1,
      queue_position: 1,
      drawing_order: 1,
    });
    // A false start does not count (decision 3A): one counted attempt, best 44870.
    expect(itemOf(data, second)).toMatchObject({
      state: "IN_PROGRESS",
      attempts_counted: 1,
      best_time_ms: 44870,
      best_rank: 2,
    });
    expect(itemOf(data, second).attempts.map((a) => a.status)).toEqual([
      "FALSE_START",
      "FINISHED",
    ]);
    expect(itemOf(data, third)).toMatchObject({
      state: "NOT_STARTED",
      best_rank: null,
      best_time_ms: null,
    });
  });

  it("gives the participant on turn its actions and nobody else", async () => {
    await asOrganizer();
    const data = await queue(SPEED);
    const [first, second, third] = seedTimeTrialOrder();
    expect(itemOf(data, second).actions).toEqual({
      create_attempt: true,
      start: false,
      stop: false,
      retry: false,
      undo: true,
      next_participant: true,
      skip: false,
      mark_dns: false,
      undo_dns: false,
      disqualify: true,
      undo_disqualify: false,
      reopen: false,
    });
    expect(itemOf(data, third).actions.create_attempt).toBe(false);
    expect(itemOf(data, third).actions.disqualify).toBe(false);
    expect(itemOf(data, first).actions).toMatchObject({
      reopen: true,
      disqualify: true,
      create_attempt: false,
    });
  });

  it("returns names, morph and bib for each participant", async () => {
    await asOrganizer();
    const first = (await queue(SPEED)).items[0];
    expect(first).toMatchObject({
      pet_name: expect.any(String),
      pet_morph_name: expect.any(String),
      owner_name: expect.any(String),
      bib_number: expect.any(String),
      round_entry_uuid: `re-${first.entry_uuid}`,
    });
  });

  it("needs a login, a related account, a time trial and a known competition", async () => {
    await call("POST", "/auth/logout");
    await expect(queue(SPEED)).rejects.toMatchObject({ status: 401 });
    await asCompetitor();
    await expect(queue(SPEED)).rejects.toMatchObject({ status: 403 });
    await asOrganizer();
    await expect(queue(SPRINT)).rejects.toMatchObject({ status: 422 });
    await expect(queue(BEAUTY)).rejects.toMatchObject({ status: 422 });
    await expect(queue("comp-nope")).rejects.toMatchObject({ status: 404 });
  });

  it("reads one attempt with its timer result, and answers 404 for an unknown one", async () => {
    await asOrganizer();
    const [first] = seedTimeTrialOrder();
    const id = `att-${first}-2`;
    const attempt = await call<ApiAttempt>("GET", `/attempts/${id}`);
    expect(attempt).toMatchObject({
      uuid: id,
      status: "FINISHED",
      round_uuid: roundOf(SPEED),
      heat_uuid: null,
      timer_result: { raw_duration_ms: 38412, final_duration_ms: 38412 },
    });
    await expect(call("GET", "/attempts/att-nope")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("the queue follows the drawing", () => {
  it("shows the locked order with positions 1..6 and only the first on turn", async () => {
    await asOrganizer();
    const order = await lockTrial();
    const data = await queue(TRIAL);
    expect(data.drawing_status).toBe("LOCKED");
    expect(orderOf(data)).toEqual(order);
    expect(data.items.map((i) => i.queue_position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(data.items.map((i) => i.drawing_order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(data.items.every((i) => i.state === "NOT_STARTED")).toBe(true);
    expect(data.current_entry_uuid).toBe(order[0]);
    expect(itemOf(data, order[0]).actions).toMatchObject({
      create_attempt: true,
      skip: true,
      mark_dns: true,
      disqualify: true,
    });
    expect(itemOf(data, order[1]).actions.create_attempt).toBe(false);
    expect(data.summary.not_started).toBe(6);
  });

  it("follows a swap made before the first attempt", async () => {
    await asOrganizer();
    const order = await lockTrial();
    await call("POST", `/competitions/${TRIAL}/drawing/swap`, {
      entry_uuid_a: order[0],
      entry_uuid_b: order[2],
    });
    const data = await queue(TRIAL);
    expect(orderOf(data).slice(0, 3)).toEqual([order[2], order[1], order[0]]);
    expect(data.current_entry_uuid).toBe(order[2]);
  });
});

describe("who may run a time trial", () => {
  it("answers 403 for an account unrelated to the competition", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    await asCompetitor();
    await expect(createAttempt(TRIAL, first, 1)).rejects.toMatchObject({
      status: 403,
    });
    await expect(skip(TRIAL, first)).rejects.toMatchObject({ status: 403 });
    await expect(patchEntry(first, { status: "DNS" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("answers 401 without a login", async () => {
    await call("POST", "/auth/logout");
    await expect(createAttempt(TRIAL, "x", 1)).rejects.toMatchObject({
      status: 401,
    });
    await expect(call("POST", "/attempts/x/start")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("lets a timer operator assigned to the competition run it", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    staffStore.assignments.push({
      uuid: "assign-timer",
      event_uuid: JAKARTA,
      competition_uuid: TRIAL,
      user_uuid: "u-competitor",
      assignment_role: "TIMER_OPERATOR",
      status: "ACTIVE",
    });
    await asCompetitor();
    const attempt = await createAttempt(TRIAL, first, 1);
    expect(attempt.status).toBe("WAITING");
    // An assignment on another competition does not count.
    staffStore.assignments[staffStore.assignments.length - 1].competition_uuid =
      SPEED;
    await expect(startAttempt(attempt.uuid)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("lets a judge penalize but not run", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    staffStore.assignments.push({
      uuid: "assign-judge",
      event_uuid: JAKARTA,
      competition_uuid: TRIAL,
      user_uuid: "u-competitor",
      assignment_role: "JUDGE",
      status: "ACTIVE",
    });
    await asCompetitor();
    await expect(stopAttempt(attempt.uuid)).rejects.toMatchObject({
      status: 403,
    });
    await expect(setStatus(attempt.uuid, "RETRY")).rejects.toMatchObject({
      status: 403,
    });
    expect((await disqualify(first)).status).toBe("ACTIVE");
  });

  it("lets a head judge change an attempt status", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    staffStore.assignments.push({
      uuid: "assign-head-judge",
      event_uuid: JAKARTA,
      competition_uuid: TRIAL,
      user_uuid: "u-competitor",
      assignment_role: "HEAD_JUDGE",
      status: "ACTIVE",
    });
    await asCompetitor();
    expect((await setStatus(attempt.uuid, "RETRY")).status).toBe("RETRY");
  });
});

describe("a full attempt: create, start, stop, record", () => {
  it("runs one attempt and updates the queue and the best time", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    expect(attempt).toMatchObject({
      entry_uuid: first,
      round_uuid: roundOf(TRIAL),
      heat_uuid: null,
      attempt_number: 1,
      status: "WAITING",
      started_at: null,
      stopped_at: null,
      timer_result: null,
      checkpoint_results: [],
    });
    let item = itemOf(await queue(TRIAL), first);
    expect(item.actions).toMatchObject({
      start: true,
      retry: true,
      create_attempt: false,
      skip: false,
    });

    const running = await startAttempt(attempt.uuid);
    expect(running.status).toBe("RUNNING");
    expect(running.started_at).toBe("2026-10-12T10:00:00+00:00");
    item = itemOf(await queue(TRIAL), first);
    expect(item.state).toBe("IN_PROGRESS");
    expect(item.actions).toMatchObject({
      stop: true,
      retry: true,
      start: false,
    });
    // The first attempt locks the order: the single match is now in progress.
    expect(drawingStore.drawings[TRIAL].matches[0].status).toBe("IN_PROGRESS");

    const stopped = await stopAttempt(attempt.uuid);
    expect(stopped.status).toBe("FINISHED");
    expect(stopped.stopped_at).not.toBeNull();
    expect(stopped.timer_result).toBeNull();
    // The time is not saved yet: no best time, and no new attempt before it is saved.
    item = itemOf(await queue(TRIAL), first);
    expect(item.best_time_ms).toBeNull();
    expect(item.actions).toMatchObject({
      create_attempt: false,
      next_participant: false,
      undo: true,
    });

    const result = await recordResult(attempt.uuid, 38412, { penalty_ms: 500 });
    expect(result).toMatchObject({
      attempt_uuid: attempt.uuid,
      raw_duration_ms: 38412,
      penalty_ms: 500,
      final_duration_ms: 38912,
      finish_status: "FINISHED",
      recorded_by_uuid: "u-organizer",
    });
    item = itemOf(await queue(TRIAL), first);
    expect(item).toMatchObject({
      attempts_counted: 1,
      best_time_ms: 38912,
      best_attempt_number: 1,
      best_rank: 1,
    });
    expect(item.actions).toMatchObject({
      create_attempt: true,
      next_participant: true,
      undo: true,
    });
    // The attempt in the queue carries the nested result, like GET /attempts/{uuid}.
    expect(item.attempts[0].timer_result?.final_duration_ms).toBe(38912);
  });

  it("keeps the fastest of several attempts as the best time", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    await runAttempt(TRIAL, first, 1, 41230);
    await runAttempt(TRIAL, first, 2, 35000);
    await runAttempt(TRIAL, first, 3, 39000);
    const item = itemOf(await queue(TRIAL), first);
    expect(item).toMatchObject({
      best_time_ms: 35000,
      best_attempt_number: 2,
      attempts_counted: 3,
    });
  });

  it("moves to the next participant with 'Next participant' and back with reopen", async () => {
    await asOrganizer();
    const [first, second] = await lockTrial();
    await runAttempt(TRIAL, first, 1, 40000);
    const done = await patchEntry(first, { status: "COMPLETED" });
    expect(done).toMatchObject({
      uuid: `re-${first}`,
      round_uuid: roundOf(TRIAL),
      entry_uuid: first,
      drawing_order: 1,
      queue_number: 1,
      queue_position: 1,
      status: "COMPLETED",
      decision_reason: null,
    });
    let data = await queue(TRIAL);
    expect(itemOf(data, first)).toMatchObject({ state: "DONE" });
    expect(itemOf(data, first).actions).toMatchObject({
      reopen: true,
      create_attempt: false,
    });
    expect(data.current_entry_uuid).toBe(second);
    expect(data.summary).toMatchObject({ done: 1, not_started: 5 });

    await patchEntry(first, { status: "IN_PROGRESS" });
    data = await queue(TRIAL);
    expect(itemOf(data, first).state).toBe("IN_PROGRESS");
    expect(data.current_entry_uuid).toBe(first);
  });

  it("is idempotent when the same status is sent again (retry after a lost response)", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    await runAttempt(TRIAL, first, 1, 40000);
    await patchEntry(first, { status: "COMPLETED" });
    expect((await patchEntry(first, { status: "COMPLETED" })).status).toBe(
      "COMPLETED",
    );
  });

  it("finishes the queue when everybody is done, DNS or disqualified", async () => {
    await asOrganizer();
    const [second, third] = seedTimeTrialOrder().slice(1, 3);
    const fourth = seedTimeTrialOrder()[3];
    await patchEntry(second, { status: "COMPLETED" });
    await patchEntry(third, { status: "DNS" });
    await patchEntry(fourth, { status: "DNS" });
    const data = await queue(SPEED);
    expect(data.current_entry_uuid).toBeNull();
    expect(data.summary).toEqual({
      total: 4,
      not_started: 0,
      in_progress: 0,
      done: 2,
      dns: 2,
      dq: 0,
    });
    expect(data.items.every((i) => !i.actions.create_attempt)).toBe(true);
  });
});

describe("creating an attempt: validation and state", () => {
  it("answers 404 when the round does not exist yet (order not locked)", async () => {
    await asOrganizer();
    const [first] = eligibleEntries(TRIAL).map((e) => e.uuid);
    await expect(createAttempt(TRIAL, first, 1)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      call("POST", "/rounds/round-nope-1/attempts", {}),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("answers 422 for a bad body, a stranger entry or a heat", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const url = `/rounds/${roundOf(TRIAL)}/attempts`;
    await expect(call("POST", url, {})).rejects.toMatchObject({ status: 422 });
    await expect(call("POST", url, { entry_id: first })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      call("POST", url, { entry_id: first, attempt_number: 0 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", url, { entry_id: "entry-nobody", attempt_number: 1 }),
    ).rejects.toMatchObject({ status: 422 });
    const [other] = seedTimeTrialOrder();
    await expect(createAttempt(TRIAL, other, 1)).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      createAttempt(TRIAL, first, 1, { heat_id: "heat-1" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("answers 422 for an attempt_number already used by this entry, even a retried one", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await setStatus(attempt.uuid, "FALSE_START");
    await expect(createAttempt(TRIAL, first, 1)).rejects.toMatchObject({
      status: 422,
    });
    expect((await createAttempt(TRIAL, first, 2)).attempt_number).toBe(2);
  });

  it("answers 409 for a participant who is not on turn", async () => {
    await asOrganizer();
    const [, second] = await lockTrial();
    await expect(createAttempt(TRIAL, second, 1)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("allows one waiting or running attempt per participant and per competition (409)", async () => {
    await asOrganizer();
    const [first, second] = await lockTrial();
    await createAttempt(TRIAL, first, 1);
    await expect(createAttempt(TRIAL, first, 2)).rejects.toMatchObject({
      status: 409,
    });
    // Another participant: not on turn, and an attempt is already waiting.
    await expect(createAttempt(TRIAL, second, 1)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("answers 409 when the competition is no longer running", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    store.competitions.find((c) => c.uuid === TRIAL)!.status = "COMPLETED";
    await expect(createAttempt(TRIAL, first, 1)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("answers 409 for a disqualified or finished participant", async () => {
    await asOrganizer();
    const [first, second] = await lockTrial();
    await disqualify(first);
    await expect(createAttempt(TRIAL, first, 1)).rejects.toMatchObject({
      status: 409,
    });
    await runAttempt(TRIAL, second, 1, 40000);
    await patchEntry(second, { status: "COMPLETED" });
    await expect(createAttempt(TRIAL, second, 2)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("start, stop and the status endpoint", () => {
  it("answers 422 for the wrong state, as the backend does", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await expect(stopAttempt(attempt.uuid)).rejects.toMatchObject({
      status: 422,
    });
    await startAttempt(attempt.uuid);
    await expect(startAttempt(attempt.uuid)).rejects.toMatchObject({
      status: 422,
    });
    await stopAttempt(attempt.uuid);
    await expect(stopAttempt(attempt.uuid)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("answers 404 for an unknown attempt", async () => {
    await asOrganizer();
    await expect(call("POST", "/attempts/nope/start")).rejects.toMatchObject({
      status: 404,
    });
    await expect(setStatus("nope", "RETRY")).rejects.toMatchObject({
      status: 404,
    });
    await expect(recordResult("nope", 1000)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("answers 422 for a missing, unknown or non-manual status", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await expect(
      call("PATCH", `/attempts/${attempt.uuid}/status`, {}),
    ).rejects.toMatchObject({ status: 422 });
    await expect(setStatus(attempt.uuid, "BOGUS")).rejects.toMatchObject({
      status: 422,
    });
    await expect(setStatus(attempt.uuid, "RUNNING")).rejects.toMatchObject({
      status: 422,
    });
    await expect(setStatus(attempt.uuid, "FINISHED")).rejects.toMatchObject({
      status: 422,
    });
  });

  it("allows only RETRY or FALSE_START on a waiting attempt (409 for the rest)", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await expect(setStatus(attempt.uuid, "TIMEOUT")).rejects.toMatchObject({
      status: 409,
    });
    await expect(setStatus(attempt.uuid, "DNF")).rejects.toMatchObject({
      status: 409,
    });
    expect((await setStatus(attempt.uuid, "RETRY")).status).toBe("RETRY");
  });

  it("treats RETRY and FALSE_START as final, and repeating the same status as a no-op", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await setStatus(attempt.uuid, "FALSE_START");
    expect((await setStatus(attempt.uuid, "FALSE_START")).status).toBe(
      "FALSE_START",
    );
    await expect(setStatus(attempt.uuid, "RETRY")).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("timer result", () => {
  it("answers 409 before the attempt is stopped", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    await expect(recordResult(attempt.uuid, 1000)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("answers 422 for a bad body", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    await stopAttempt(attempt.uuid);
    const url = `/attempts/${attempt.uuid}/timer-result`;
    await expect(
      call("POST", url, { finish_status: "FINISHED" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(recordResult(attempt.uuid, -1)).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      recordResult(attempt.uuid, 1000, { penalty_ms: -5 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", url, { raw_duration_ms: 1000 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      recordResult(attempt.uuid, 1000, { finish_status: "DNF" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("answers 422 when a result is already recorded, but replays the same request id", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    await stopAttempt(attempt.uuid);
    const result = await recordResult(attempt.uuid, 38412, {
      client_request_id: "req-1",
    });
    expect(result.client_request_id).toBe("req-1");
    const replay = await recordResult(attempt.uuid, 38412, {
      client_request_id: "req-1",
    });
    expect(replay.uuid).toBe(result.uuid);
    await expect(
      recordResult(attempt.uuid, 38412, { client_request_id: "req-2" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(recordResult(attempt.uuid, 38412)).rejects.toMatchObject({
      status: 422,
    });
    // Only one result was stored for this attempt.
    expect(
      timetrialStore.attempts.filter(
        (a) => a.entry_uuid === first && a.timer_result !== null,
      ),
    ).toHaveLength(1);
  });

  it("refuses a time at or over the cut-off (422), accepts one just below", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    await stopAttempt(attempt.uuid);
    await expect(recordResult(attempt.uuid, 120000)).rejects.toMatchObject({
      status: 422,
    });
    await expect(recordResult(attempt.uuid, 150000)).rejects.toMatchObject({
      status: 422,
    });
    expect((await recordResult(attempt.uuid, 119999)).final_duration_ms).toBe(
      119999,
    );
  });
});

describe("cut-off timeout", () => {
  it("stops a running attempt as TIMEOUT: it uses an attempt but has no valid time", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    const timedOut = await setStatus(attempt.uuid, "TIMEOUT");
    expect(timedOut.status).toBe("TIMEOUT");
    expect(timedOut.stopped_at).not.toBeNull();
    expect(timedOut.timer_result).toBeNull();
    const item = itemOf(await queue(TRIAL), first);
    expect(item).toMatchObject({
      attempts_counted: 1,
      best_time_ms: null,
      best_rank: null,
    });
    expect(item.actions).toMatchObject({
      create_attempt: true,
      next_participant: true,
      undo: true,
    });
  });
});

describe("retry does not use an attempt (decision 3A)", () => {
  it("lets a participant run three counted attempts after retries, then refuses a fourth (409)", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    // Attempt 1: false start. Attempt 2: cancelled while waiting. Then three counted ones.
    const falseStart = await createAttempt(TRIAL, first, 1);
    await startAttempt(falseStart.uuid);
    expect((await setStatus(falseStart.uuid, "FALSE_START")).status).toBe(
      "FALSE_START",
    );
    let item = itemOf(await queue(TRIAL), first);
    expect(item.attempts_counted).toBe(0);
    expect(item.actions.create_attempt).toBe(true);
    // Not counted, so nothing was used: the participant can still be skipped.
    expect(item.actions.skip).toBe(true);

    const cancelled = await createAttempt(TRIAL, first, 2);
    expect((await setStatus(cancelled.uuid, "RETRY")).status).toBe("RETRY");

    await runAttempt(TRIAL, first, 3, 41000);
    await runAttempt(TRIAL, first, 4, 40000);
    item = itemOf(await queue(TRIAL), first);
    expect(item.attempts_counted).toBe(2);
    expect(item.actions.create_attempt).toBe(true);
    await runAttempt(TRIAL, first, 5, 39000);

    item = itemOf(await queue(TRIAL), first);
    expect(item.attempts_counted).toBe(3);
    expect(item.attempts.map((a) => a.attempt_number)).toEqual([1, 2, 3, 4, 5]);
    expect(item.actions).toMatchObject({
      create_attempt: false,
      next_participant: true,
    });
    await expect(createAttempt(TRIAL, first, 6)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("counts a TIMEOUT and a DNF, but not a false start, toward the limit", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const timeout = await createAttempt(TRIAL, first, 1);
    await startAttempt(timeout.uuid);
    await setStatus(timeout.uuid, "TIMEOUT");
    const dnf = await createAttempt(TRIAL, first, 2);
    await startAttempt(dnf.uuid);
    await setStatus(dnf.uuid, "DNF");
    const retry = await createAttempt(TRIAL, first, 3);
    await startAttempt(retry.uuid);
    await setStatus(retry.uuid, "FALSE_START");
    const item = itemOf(await queue(TRIAL), first);
    expect(item.attempts_counted).toBe(2);
    expect(item.actions.create_attempt).toBe(true);
  });
});

describe("undo a finished attempt", () => {
  it("sets RETRY, gives the attempt back and drops it from the best time", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const id = await runAttempt(TRIAL, first, 1, 38412);
    expect(itemOf(await queue(TRIAL), first).best_time_ms).toBe(38412);
    const undone = await setStatus(id, "RETRY");
    expect(undone.status).toBe("RETRY");
    // The old result stays stored (the backend has no delete), but is ignored.
    expect(undone.timer_result).not.toBeNull();
    const item = itemOf(await queue(TRIAL), first);
    expect(item).toMatchObject({
      attempts_counted: 0,
      best_time_ms: null,
      best_rank: null,
    });
    expect(item.actions).toMatchObject({ create_attempt: true, undo: false });
    // The cancelled number is gone for good: the next attempt takes the next number.
    await expect(createAttempt(TRIAL, first, 1)).rejects.toMatchObject({
      status: 422,
    });
    expect((await createAttempt(TRIAL, first, 2)).status).toBe("WAITING");
  });

  it("also undoes a timeout", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    await setStatus(attempt.uuid, "TIMEOUT");
    expect((await setStatus(attempt.uuid, "RETRY")).status).toBe("RETRY");
    expect(itemOf(await queue(TRIAL), first).attempts_counted).toBe(0);
  });

  it("answers 409 after 'Next participant' until the participant is reopened", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const id = await runAttempt(TRIAL, first, 1, 38412);
    await patchEntry(first, { status: "COMPLETED" });
    await expect(setStatus(id, "RETRY")).rejects.toMatchObject({ status: 409 });
    await patchEntry(first, { status: "IN_PROGRESS" });
    expect((await setStatus(id, "RETRY")).status).toBe("RETRY");
  });

  it("answers 409 while another attempt of the participant is waiting", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const id = await runAttempt(TRIAL, first, 1, 38412);
    await createAttempt(TRIAL, first, 2);
    await expect(setStatus(id, "RETRY")).rejects.toMatchObject({ status: 409 });
  });
});

describe("skip to next", () => {
  it("moves the participant to the end without using anything", async () => {
    await asOrganizer();
    const order = await lockTrial();
    const data = await skip(TRIAL, order[0]);
    expect(orderOf(data)).toEqual([...order.slice(1), order[0]]);
    expect(data.current_entry_uuid).toBe(order[1]);
    const skipped = itemOf(data, order[0]);
    expect(skipped).toMatchObject({
      state: "NOT_STARTED",
      attempts: [],
      attempts_counted: 0,
      queue_position: 6,
      drawing_order: 1,
      queue_number: 1,
    });
    expect(data.summary.not_started).toBe(6);
    // The same data comes back from a plain GET.
    expect(orderOf(await queue(TRIAL))).toEqual(orderOf(data));
  });

  it("can be repeated: the latest skipped goes last", async () => {
    await asOrganizer();
    const order = await lockTrial();
    await skip(TRIAL, order[0]);
    const data = await skip(TRIAL, order[1]);
    expect(orderOf(data)).toEqual([...order.slice(2), order[0], order[1]]);
    expect(data.current_entry_uuid).toBe(order[2]);
  });

  it("brings the skipped participant back when everyone else is done", async () => {
    await asOrganizer();
    const order = await lockTrial();
    await skip(TRIAL, order[0]);
    for (const entry of order.slice(1)) {
      await patchEntry(entry, { status: "DNS" });
    }
    const data = await queue(TRIAL);
    expect(data.current_entry_uuid).toBe(order[0]);
  });

  it("answers 409 for a participant who is not on turn, who used an attempt or who is alone", async () => {
    await asOrganizer();
    const order = await lockTrial();
    await expect(skip(TRIAL, order[1])).rejects.toMatchObject({ status: 409 });
    // SPEED: the participant on turn already has a counted attempt.
    const [, second, third, fourth] = seedTimeTrialOrder();
    await expect(skip(SPEED, second)).rejects.toMatchObject({ status: 409 });
    await patchEntry(second, { status: "COMPLETED" });
    await patchEntry(third, { status: "DNS" });
    // Only the fourth is left: nobody to skip to.
    await expect(skip(SPEED, fourth)).rejects.toMatchObject({ status: 409 });
  });

  it("answers 409 while an attempt of the participant is waiting", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    await createAttempt(TRIAL, first, 1);
    await expect(skip(TRIAL, first)).rejects.toMatchObject({ status: 409 });
  });

  it("answers 403, 404 and 422 before moving anything", async () => {
    await asOrganizer();
    const order = await lockTrial();
    await expect(skip("comp-nope", order[0])).rejects.toMatchObject({
      status: 404,
    });
    await expect(skip(TRIAL, "entry-nobody")).rejects.toMatchObject({
      status: 404,
    });
    await expect(skip(SPRINT, order[0])).rejects.toMatchObject({ status: 422 });
    await asCompetitor();
    await expect(skip(TRIAL, order[0])).rejects.toMatchObject({ status: 403 });
    await asOrganizer();
    expect(orderOf(await queue(TRIAL))).toEqual(order);
  });
});

describe("did not start (round entry DNS)", () => {
  it("marks the participant on turn as DNS, moves on, and can be undone", async () => {
    await asOrganizer();
    const [first, second] = await lockTrial();
    const dns = await patchEntry(first, {
      status: "DNS",
      decision_reason: "No show",
    });
    expect(dns).toMatchObject({ status: "DNS", decision_reason: "No show" });
    let data = await queue(TRIAL);
    expect(itemOf(data, first)).toMatchObject({ state: "DNS", status: "DNS" });
    expect(itemOf(data, first).actions).toMatchObject({
      undo_dns: true,
      create_attempt: false,
    });
    expect(data.current_entry_uuid).toBe(second);
    expect(data.summary.dns).toBe(1);

    await patchEntry(first, { status: "WAITING" });
    data = await queue(TRIAL);
    expect(itemOf(data, first).state).toBe("NOT_STARTED");
    expect(data.current_entry_uuid).toBe(first);
  });

  it("answers 409 once an attempt was counted, or when it is not the participant's turn", async () => {
    await asOrganizer();
    const [, second, third] = seedTimeTrialOrder();
    await expect(patchEntry(second, { status: "DNS" })).rejects.toMatchObject({
      status: 409,
    });
    await expect(patchEntry(third, { status: "DNS" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("answers 422 for statuses this version does not support, and 409 for odd moves", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    for (const status of ["CALLED", "JUDGING", "DSQ"])
      await expect(patchEntry(first, { status })).rejects.toMatchObject({
        status: 422,
      });
    await expect(patchEntry(first, { status: "BOGUS" })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      patchEntry(first, { decision_reason: 5 }),
    ).rejects.toMatchObject({ status: 422 });
    // WAITING only undoes DNS; IN_PROGRESS only reopens a done participant; Next needs an attempt.
    await expect(
      patchEntry(first, { status: "IN_PROGRESS" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      patchEntry(first, { status: "COMPLETED" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("answers 404 for an unknown round entry", async () => {
    await asOrganizer();
    await expect(
      call("PATCH", "/round-entries/re-nobody", { status: "DNS" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      call("PATCH", "/round-entries/not-a-mock-id", { status: "DNS" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("answers 409 for 'Next participant' while an attempt is waiting or running", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    await runAttempt(TRIAL, first, 1, 40000);
    const attempt = await createAttempt(TRIAL, first, 2);
    await expect(
      patchEntry(first, { status: "COMPLETED" }),
    ).rejects.toMatchObject({ status: 409 });
    await startAttempt(attempt.uuid);
    await expect(
      patchEntry(first, { status: "COMPLETED" }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("disqualify (penalty DISQUALIFICATION)", () => {
  it("takes the participant out: state DQ, no best time, undo available", async () => {
    await asOrganizer();
    const [first, second] = await lockTrial();
    const penalty = await disqualify(first, "Left the lane");
    expect(penalty).toMatchObject({
      entry_uuid: first,
      penalty_type: "DISQUALIFICATION",
      penalty_unit: "DISQUALIFICATION",
      penalty_value: "0.00",
      reason: "Left the lane",
      status: "ACTIVE",
      attempt_uuid: null,
    });
    const data = await queue(TRIAL);
    expect(itemOf(data, first)).toMatchObject({
      state: "DQ",
      status: "DSQ",
      best_time_ms: null,
      best_rank: null,
    });
    expect(itemOf(data, first).actions).toMatchObject({
      undo_disqualify: true,
      disqualify: false,
      create_attempt: false,
    });
    expect(itemOf(data, first).penalties).toHaveLength(1);
    expect(data.current_entry_uuid).toBe(second);
    expect(data.summary.dq).toBe(1);
  });

  it("removes a disqualified participant from the ranking", async () => {
    await asOrganizer();
    const [first, second] = seedTimeTrialOrder();
    expect(itemOf(await queue(SPEED), first).best_rank).toBe(1);
    await disqualify(first);
    const data = await queue(SPEED);
    expect(itemOf(data, first).best_rank).toBeNull();
    expect(itemOf(data, second).best_rank).toBe(1);
  });

  it("drops the running attempt of a disqualified participant (DSQ)", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const attempt = await createAttempt(TRIAL, first, 1);
    await startAttempt(attempt.uuid);
    await disqualify(first);
    const after = await call<ApiAttempt>("GET", `/attempts/${attempt.uuid}`);
    expect(after.status).toBe("DSQ");
    expect(after.stopped_at).not.toBeNull();
    // The competition is free again: nobody holds an active attempt.
    const data = await queue(TRIAL);
    expect(data.current_entry_uuid).not.toBe(first);
  });

  it("revokes the disqualification and puts the participant back", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    const penalty = await disqualify(first);
    expect((await revoke(penalty.uuid)).status).toBe("REVOKED");
    const data = await queue(TRIAL);
    expect(itemOf(data, first).state).toBe("NOT_STARTED");
    expect(data.current_entry_uuid).toBe(first);
    await expect(revoke(penalty.uuid)).rejects.toMatchObject({ status: 422 });
  });

  it("answers 422 for a bad penalty and 409 for the wrong moment", async () => {
    await asOrganizer();
    const [first, second] = await lockTrial();
    const url = `/entries/${first}/penalties`;
    await expect(call("POST", url, {})).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", url, {
        penalty_type: "TIME",
        penalty_value: 5,
        penalty_unit: "MILLISECONDS",
        reason: "Late",
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", url, {
        penalty_type: "DISQUALIFICATION",
        penalty_value: 0,
        penalty_unit: "DISQUALIFICATION",
        reason: "  ",
      }),
    ).rejects.toMatchObject({ status: 422 });
    // Not on turn and no attempt yet.
    await expect(disqualify(second)).rejects.toMatchObject({ status: 409 });
    await disqualify(first);
    await expect(disqualify(first)).rejects.toMatchObject({ status: 409 });
    await patchEntry(second, { status: "DNS" });
    await expect(disqualify(second)).rejects.toMatchObject({ status: 409 });
  });

  it("answers 404 and 403 for unknown or foreign data", async () => {
    await asOrganizer();
    await expect(revoke("pen-nope")).rejects.toMatchObject({ status: 404 });
    const [first] = await lockTrial();
    const penalty = await disqualify(first);
    await asCompetitor();
    await expect(revoke(penalty.uuid)).rejects.toMatchObject({ status: 403 });
    await expect(disqualify(first)).rejects.toMatchObject({ status: 403 });
  });

  it("leaves Run Match penalties to the Race mock", async () => {
    await asOrganizer();
    // A Race entry whose match has not started: the Run Match rule answers 409.
    await expect(
      disqualify("entry-glider-sprint-heats-001"),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("best times ranking", () => {
  it("orders participants by their fastest valid attempt", async () => {
    await asOrganizer();
    const [first, second, third] = seedTimeTrialOrder();
    await patchEntry(second, { status: "COMPLETED" });
    await runAttempt(SPEED, third, 1, 40000);
    const data = await queue(SPEED);
    expect(itemOf(data, first).best_rank).toBe(1); // 38412
    expect(itemOf(data, third).best_rank).toBe(2); // 40000
    expect(itemOf(data, second).best_rank).toBe(3); // 44870
  });

  it("breaks a tie by the earlier achieved time", async () => {
    await asOrganizer();
    const [first, second] = seedTimeTrialOrder();
    // Same 38412 as the first participant, but achieved later (today versus the seed).
    await runAttempt(SPEED, second, 3, 38412);
    const data = await queue(SPEED);
    expect(itemOf(data, first).best_rank).toBe(1);
    expect(itemOf(data, second)).toMatchObject({
      best_time_ms: 38412,
      best_rank: 2,
      best_attempt_number: 3,
    });
  });

  it("adds the penalty to the time and ranks by the final time", async () => {
    await asOrganizer();
    const [first, second] = seedTimeTrialOrder();
    // 37000 raw + 2000 penalty = 39000: slower than the first participant's 38412, faster than 44870.
    await runAttempt(SPEED, second, 3, 37000, { penalty_ms: 2000 });
    const data = await queue(SPEED);
    expect(itemOf(data, second)).toMatchObject({
      best_time_ms: 39000,
      best_rank: 2,
    });
    expect(itemOf(data, first).best_rank).toBe(1);
  });
});

describe("registration reopen and reset", () => {
  it("removes the queue and its attempts when registration is reopened", async () => {
    await asOrganizer();
    const [first] = await lockTrial();
    await runAttempt(TRIAL, first, 1, 40000);
    await call("POST", `/competitions/${TRIAL}/reopen-registration`, {});
    const data = await queue(TRIAL);
    expect(data.drawing_status).toBe("NOT_DRAWN");
    expect(data.items).toEqual([]);
    expect(
      timetrialStore.attempts.some((a) =>
        a.round_uuid.startsWith(roundOf(TRIAL)),
      ),
    ).toBe(false);
    expect(timetrialStore.skips[TRIAL]).toBeUndefined();
    // Close again and draw anew: a clean queue.
    await call("POST", `/competitions/${TRIAL}/close-registration`, {});
    const order = await lockTrial();
    const fresh = await queue(TRIAL);
    expect(fresh.items.every((i) => i.attempts.length === 0)).toBe(true);
    expect(fresh.current_entry_uuid).toBe(order[0]);
  });

  it("restores the seed on reset", async () => {
    await asOrganizer();
    const [first] = seedTimeTrialOrder();
    await disqualify(first);
    await patchEntry(seedTimeTrialOrder()[1], { status: "COMPLETED" });
    resetTimetrialStore();
    const data = await queue(SPEED);
    expect(itemOf(data, first).state).toBe("DONE");
    expect(data.current_entry_uuid).toBe(seedTimeTrialOrder()[1]);
    expect(timetrialStore.attempts).toHaveLength(4);
    expect(timetrialStore.penalties).toEqual([]);
  });
});
