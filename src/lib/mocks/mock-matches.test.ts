import { afterEach, describe, expect, it } from "vitest";
import { confirmBody } from "@/domains/matches/api";
import { matchOutcomes } from "@/domains/matches/rank";
import {
  fromApi,
  type ApiFinishCapture,
  type ApiHeatEntry,
  type ApiMatch,
  type ApiMatchList,
  type ApiPenalty,
  type ApiRaceSession,
} from "@/domains/matches/types";
import type { ApiEventEntries } from "@/domains/entries/types";
import type { ApiCompetitionResults } from "@/domains/results/types";
import type { ApiDrawing } from "@/domains/drawing/types";
import { drawingStore } from "./mock-drawing";
import { matchStore, resetMatchStore } from "./mock-matches";
import { mockRequest } from "./mock-request";
import { resetStaffStore, staffStore } from "./mock-staff";
import { DEMO_PASSWORD, store } from "./mock-store";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk sama dengan kontrak Run Match. */
const SPRINT = "comp-glider-sprint-heats"; // Race, SCHEDULED, SUDAH di-lock: match 4+4+3
const DERBY = "comp-glider-derby"; // Race, SCHEDULED, BELUM di-lock
const BEAUTY = "comp-beauty-class-open"; // bukan Race
const JAKARTA = "evt-jakarta-pet-festival";
const HEAT_1 = "heat-glider-sprint-heats-1";
const HEAT_2 = "heat-glider-sprint-heats-2";
const HEAT_3 = "heat-glider-sprint-heats-3";

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
const asSari = () => signIn("sari.wulandari@petpet.dev"); // COMPETITION_PIC Glider Sprint Heats

const list = (competition: string) =>
  call<ApiMatchList>("GET", `/competitions/${competition}/matches`);
const detail = (heat: string) => call<ApiMatch>("GET", `/matches/${heat}`);

const newSession = (heat: string, over: Record<string, unknown> = {}) =>
  call<ApiRaceSession>("POST", `/heats/${heat}/sessions`, {
    session_number: 1,
    countdown_seconds: 3,
    cutoff_time_ms: 90000,
    ...over,
  });
const start = (session: string) =>
  call<ApiRaceSession>("POST", `/sessions/${session}/start`);
const stop = (session: string, reason = "MANUAL") =>
  call<ApiRaceSession>("POST", `/sessions/${session}/stop`, {
    stop_reason: reason,
  });
const capture = (
  session: string,
  order: number,
  ms: number,
  extra: Record<string, unknown> = {},
) =>
  call<ApiFinishCapture>("POST", `/sessions/${session}/finishes`, {
    finish_order: order,
    captured_time_ms: ms,
    ...extra,
  });
const assign = (captureUuid: string, entryUuid: string) =>
  call<ApiFinishCapture>("PATCH", `/finishes/${captureUuid}/assign`, {
    assigned_entry_id: entryUuid,
  });
/** Satu ketukan Finish seperti klien: capture lalu assign ke entry. */
async function tap(session: string, order: number, ms: number, entry: string) {
  const made = await capture(session, order, ms);
  return assign(made.uuid, entry);
}
const setCallStatus = (heatEntryUuid: string, status: string) =>
  call<ApiHeatEntry>("PATCH", `/heat-entries/${heatEntryUuid}`, {
    call_status: status,
  });
const disqualify = (entry: string, reason = "False start") =>
  call<ApiPenalty>("POST", `/entries/${entry}/penalties`, {
    penalty_type: "DISQUALIFICATION",
    penalty_value: 0,
    penalty_unit: "DISQUALIFICATION",
    reason,
  });
/** Confirm dengan hasil yang dihitung klien (`matchOutcomes`), seperti layar. */
async function confirm(heat: string) {
  const match = fromApi(await detail(heat));
  return call<ApiMatch>("POST", `/heats/${heat}/confirm`, {
    ...confirmBody(matchOutcomes(match)),
  });
}

/**
 * Menjalankan satu match sampai Confirm. `dnsLanes` ditandai sebelum start, `dqLanes` didiskualifikasi
 * setelah start, `times` = waktu finish per nomor lane (diketuk menurut waktu terkecil dulu).
 */
async function runMatch(
  heat: string,
  spec: {
    dnsLanes?: number[];
    dqLanes?: number[];
    times: Record<number, number>;
  },
) {
  const before = await detail(heat);
  const entryOf = (lane: number) => before.lanes[lane - 1];
  for (const lane of spec.dnsLanes ?? [])
    await setCallStatus(entryOf(lane).uuid, "DNS");
  const session = await newSession(heat);
  await start(session.uuid);
  for (const lane of spec.dqLanes ?? [])
    await disqualify(entryOf(lane).entry_uuid);
  const order = Object.entries(spec.times)
    .map(([lane, ms]) => ({ lane: Number(lane), ms }))
    .sort((a, b) => a.ms - b.ms);
  let finishOrder = 1;
  for (const { lane, ms } of order)
    await tap(session.uuid, finishOrder++, ms, entryOf(lane).entry_uuid);
  await stop(session.uuid);
  return confirm(heat);
}

// Tes mengubah kompetisi, entry, staf, dan drawing: kembalikan setelah tiap tes.
const seedCompetitions = structuredClone(store.competitions);
const seedEntriesCopy = structuredClone(store.entries);
afterEach(() => {
  store.competitions = structuredClone(seedCompetitions);
  store.entries = structuredClone(seedEntriesCopy);
  resetStaffStore();
  resetMatchStore();
});

describe("seed and reading", () => {
  it("lists the three not-started matches of the locked drawing (4+4+3)", async () => {
    await asOrganizer();
    const data = await list(SPRINT);
    expect(data.drawing_status).toBe("LOCKED");
    expect(data.items.map((m) => m.match_number)).toEqual([1, 2, 3]);
    expect(data.items.map((m) => m.uuid)).toEqual([HEAT_1, HEAT_2, HEAT_3]);
    expect(data.items.map((m) => m.planned_lanes.length)).toEqual([4, 4, 3]);
    expect(data.items.every((m) => m.status === "NOT_STARTED")).toBe(true);
    expect(data.items.every((m) => m.current_session === null)).toBe(true);
    expect(data.items[0].planned_lanes[0]).toMatchObject({
      lane_number: 1,
      pet_name: expect.any(String),
      bib_number: expect.any(String),
    });
  });

  it("lists nothing for a competition whose drawing is not locked", async () => {
    await asOrganizer();
    expect(await list(DERBY)).toEqual({
      competition_uuid: DERBY,
      drawing_status: "NOT_DRAWN",
      items: [],
    });
  });

  it("needs a login, a related account, a Race and a known competition", async () => {
    await call("POST", "/auth/logout");
    await expect(list(SPRINT)).rejects.toMatchObject({ status: 401 });
    await asCompetitor();
    await expect(list(SPRINT)).rejects.toMatchObject({ status: 403 });
    await expect(detail(HEAT_1)).rejects.toMatchObject({ status: 403 });
    await asOrganizer();
    await expect(list(BEAUTY)).rejects.toMatchObject({ status: 422 });
    await expect(list("comp-nope")).rejects.toMatchObject({ status: 404 });
    await expect(detail("heat-nope")).rejects.toMatchObject({ status: 404 });
  });

  it("returns a match with lanes, defaults from the active rule and the first actions", async () => {
    await asOrganizer();
    const match = await detail(HEAT_1);
    expect(match).toMatchObject({
      uuid: HEAT_1,
      competition_uuid: SPRINT,
      match_number: 1,
      total_matches: 3,
      status: "NOT_STARTED",
      heat_status: "SCHEDULED",
      started_at: null,
      finished_at: null,
      session_defaults: { countdown_seconds: 3, cutoff_time_ms: 90000 },
      sessions: [],
      current_session_uuid: null,
    });
    expect(match.lanes.map((l) => l.lane_number)).toEqual([1, 2, 3, 4]);
    expect(match.lanes[0]).toMatchObject({
      call_status: "WAITING",
      position: null,
      completed_time_ms: null,
      penalties: [],
    });
    expect(match.actions).toEqual({
      create_session: true,
      start: false,
      finish: false,
      stop: false,
      rematch: false,
      mark_dns: true,
      disqualify: false,
      confirm: false,
    });
    expect(match.lanes[0].actions).toMatchObject({
      finish: false,
      mark_dns: true,
      undo_dns: false,
      disqualify: false,
    });
  });
});

describe("who may run a match", () => {
  it("lets the competition PIC run it", async () => {
    await asSari();
    const match = await detail(HEAT_1);
    expect(match.actions.create_session).toBe(true);
    const session = await newSession(HEAT_1);
    expect(session.status).toBe("READY");
  });

  it("answers 403 for an unrelated account and for a judge, who may only penalize", async () => {
    await asCompetitor();
    await expect(newSession(HEAT_1)).rejects.toMatchObject({ status: 403 });
    staffStore.assignments.push({
      uuid: "assign-judge",
      event_uuid: JAKARTA,
      competition_uuid: SPRINT,
      user_uuid: "u-competitor",
      assignment_role: "JUDGE",
      status: "ACTIVE",
    });
    await expect(newSession(HEAT_1)).rejects.toMatchObject({ status: 403 });
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const lane = (await detail(HEAT_1)).lanes[0];
    await asCompetitor();
    await expect(start(session.uuid)).rejects.toMatchObject({ status: 403 });
    await expect(setCallStatus(lane.uuid, "DNS")).rejects.toMatchObject({
      status: 403,
    });
    const penalty = await disqualify(lane.entry_uuid);
    expect(penalty.status).toBe("ACTIVE");
  });

  it("lets a timer operator assigned to the competition run it", async () => {
    await asCompetitor();
    await expect(detail(HEAT_1)).rejects.toMatchObject({ status: 403 });
    staffStore.assignments.push({
      uuid: "assign-timer",
      event_uuid: JAKARTA,
      competition_uuid: SPRINT,
      user_uuid: "u-competitor",
      assignment_role: "TIMER_OPERATOR",
      status: "ACTIVE",
    });
    expect((await detail(HEAT_1)).actions.create_session).toBe(true);
    // Penugasan di kompetisi lain tidak berlaku.
    staffStore.assignments[staffStore.assignments.length - 1].competition_uuid =
      DERBY;
    await expect(newSession(HEAT_1)).rejects.toMatchObject({ status: 403 });
  });
});

describe("a full match: create session, start, finishes, stop, confirm", () => {
  it("runs from READY to DONE and writes position and time to every lane", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;

    const session = await newSession(HEAT_1);
    expect(session).toMatchObject({
      heat_uuid: HEAT_1,
      session_number: 1,
      status: "READY",
      countdown_seconds: 3,
      cutoff_time_ms: 90000,
      started_at: null,
      rematch_of_session_uuid: null,
      finish_captures: [],
    });
    let match = await detail(HEAT_1);
    expect(match.current_session_uuid).toBe(session.uuid);
    expect(match.actions).toMatchObject({
      create_session: false,
      start: true,
      finish: false,
    });

    const running = await start(session.uuid);
    expect(running.status).toBe("RUNNING");
    expect(running.started_at).toMatch(/\+00:00$/);
    match = await detail(HEAT_1);
    expect(match).toMatchObject({
      status: "RUNNING",
      heat_status: "IN_PROGRESS",
    });
    expect(match.started_at).toMatch(/\+00:00$/);
    expect(match.actions).toMatchObject({
      start: false,
      finish: true,
      stop: true,
      rematch: true,
      disqualify: true,
      confirm: false,
    });
    expect((await list(SPRINT)).items[0].status).toBe("RUNNING");

    // Lane 2 paling cepat, lalu lane 1, lalu lane 3. Lane 4 tidak finish.
    await tap(session.uuid, 1, 31250, lanes[1].entry_uuid);
    await tap(session.uuid, 2, 38412, lanes[0].entry_uuid);
    const third = await tap(session.uuid, 3, 40003, lanes[2].entry_uuid);
    expect(third).toMatchObject({
      assignment_status: "ASSIGNED",
      assigned_entry_uuid: lanes[2].entry_uuid,
      captured_time_ms: 40003,
    });
    match = await detail(HEAT_1);
    expect(match.lanes[1].actions.finish).toBe(false);
    expect(match.lanes[3].actions.finish).toBe(true);
    expect(match.sessions[0].finish_captures).toHaveLength(3);

    const stopped = await stop(session.uuid, "MANUAL");
    expect(stopped).toMatchObject({
      status: "FINISHED",
      stop_reason: "MANUAL",
    });
    match = await detail(HEAT_1);
    expect(match.actions).toMatchObject({
      finish: false,
      stop: false,
      confirm: true,
    });

    const done = await confirm(HEAT_1);
    expect(done).toMatchObject({
      status: "DONE",
      heat_status: "COMPLETED",
      actions: { confirm: false, create_session: false, rematch: false },
    });
    expect(done.finished_at).toMatch(/\+00:00$/);
    expect(
      done.lanes.map((l) => [
        l.lane_number,
        l.call_status,
        l.position,
        l.completed_time_ms,
      ]),
    ).toEqual([
      [1, "FINISHED", 2, 38412],
      [2, "FINISHED", 1, 31250],
      [3, "FINISHED", 3, 40003],
      [4, "DNF", 4, null],
    ]);
    expect(done.lanes.every((l) => !l.actions.undo_finish)).toBe(true);
    const listed = await list(SPRINT);
    expect(listed.items.map((m) => m.status)).toEqual([
      "DONE",
      "NOT_STARTED",
      "NOT_STARTED",
    ]);
  });

  it("ends a match at the cut-off: finishes after it become DNF", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1, { cutoff_time_ms: 60000 });
    await start(session.uuid);
    await tap(session.uuid, 1, 45000, lanes[0].entry_uuid);
    // Operator terlambat mengetuk: waktunya melewati cut-off.
    await tap(session.uuid, 2, 61000, lanes[1].entry_uuid);
    expect((await stop(session.uuid, "CUTOFF")).status).toBe("CUTOFF");
    const done = await confirm(HEAT_1);
    expect(
      done.lanes.map((l) => [l.call_status, l.position, l.completed_time_ms]),
    ).toEqual([
      ["FINISHED", 1, 45000],
      ["DNF", 2, null],
      ["DNF", 3, null],
      ["DNF", 4, null],
    ]);
  });
});

describe("session rules", () => {
  it("only starts a READY session and only stops a RUNNING one", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await expect(stop(session.uuid)).rejects.toMatchObject({ status: 422 });
    await start(session.uuid);
    await expect(start(session.uuid)).rejects.toMatchObject({ status: 422 });
    await expect(stop(session.uuid, "NOPE")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      call("POST", `/sessions/${session.uuid}/stop`, {}),
    ).rejects.toMatchObject({ status: 422 });
    await stop(session.uuid, "TECHNICAL_ISSUE");
    await expect(stop(session.uuid)).rejects.toMatchObject({ status: 422 });
    await expect(start("nope")).rejects.toMatchObject({ status: 404 });
  });

  it("validates the body of a new session", async () => {
    await asOrganizer();
    await expect(
      call("POST", `/heats/${HEAT_1}/sessions`, {}),
    ).rejects.toMatchObject({
      status: 422,
      errors: {
        session_number: expect.any(Array),
        cutoff_time_ms: expect.any(Array),
      },
    });
    await expect(
      newSession(HEAT_1, { rematch_of_session_id: "nope" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      newSession(HEAT_1, { session_number: 0 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(newSession("heat-nope")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("keeps one session per match: a second one needs a rematch", async () => {
    await asOrganizer();
    const first = await newSession(HEAT_1);
    await expect(
      newSession(HEAT_1, { session_number: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(newSession(HEAT_1)).rejects.toMatchObject({ status: 422 });
    // READY belum mulai, jadi belum bisa di-rematch.
    await expect(
      newSession(HEAT_1, {
        session_number: 2,
        rematch_of_session_id: first.uuid,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await detail(HEAT_1)).actions.rematch).toBe(false);
  });

  it("runs a match again with a rematch: the old session is REMATCHED and finishes start empty", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const first = await newSession(HEAT_1);
    await start(first.uuid);
    await tap(first.uuid, 1, 30000, lanes[0].entry_uuid);
    expect((await detail(HEAT_1)).actions.rematch).toBe(true);

    const second = await newSession(HEAT_1, {
      session_number: 2,
      rematch_of_session_id: first.uuid,
    });
    expect(second).toMatchObject({
      status: "READY",
      rematch_of_session_uuid: first.uuid,
    });
    const match = await detail(HEAT_1);
    expect(match.sessions.map((s) => [s.session_number, s.status])).toEqual([
      [1, "REMATCHED"],
      [2, "READY"],
    ]);
    expect(match.current_session_uuid).toBe(second.uuid);
    // Finish dari sesi lama tidak ikut: bisa start lagi dan lane 1 boleh finish.
    await start(second.uuid);
    expect((await detail(HEAT_1)).lanes[0].actions.finish).toBe(true);
    // Sesi lama tidak bisa dihentikan, di-start, atau ditetapkan lagi.
    await expect(stop(first.uuid)).rejects.toMatchObject({ status: 422 });
    const old = matchStore.captures.find(
      (c) => c.race_session_uuid === first.uuid,
    ) as ApiFinishCapture;
    await expect(assign(old.uuid, lanes[1].entry_uuid)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      call("POST", `/finishes/${old.uuid}/void`),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("can rematch a stopped session until the result is confirmed", async () => {
    await asOrganizer();
    const first = await newSession(HEAT_1);
    await start(first.uuid);
    await stop(first.uuid, "TECHNICAL_ISSUE");
    const second = await newSession(HEAT_1, {
      session_number: 2,
      rematch_of_session_id: first.uuid,
    });
    await start(second.uuid);
    await stop(second.uuid);
    await confirm(HEAT_1);
    await expect(
      newSession(HEAT_1, {
        session_number: 3,
        rematch_of_session_id: second.uuid,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await detail(HEAT_1)).actions.rematch).toBe(false);
  });

  it("does not run matches of a competition that is not scheduled or ongoing", async () => {
    await asOrganizer();
    const competition = store.competitions.find((c) => c.uuid === SPRINT);
    if (!competition) throw new Error("seed competition missing");
    competition.status = "COMPLETED";
    await expect(newSession(HEAT_1)).rejects.toMatchObject({ status: 409 });
    expect((await detail(HEAT_1)).actions.create_session).toBe(false);
  });

  it("makes swapping in the drawing impossible once a match started", async () => {
    await asOrganizer();
    const drawing = await call<ApiDrawing>(
      "GET",
      `/competitions/${SPRINT}/drawing`,
    );
    const [a, b] = drawing.matches[0].lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await expect(
      call("POST", `/competitions/${SPRINT}/drawing/swap`, {
        entry_uuid_a: a.entry_uuid,
        entry_uuid_b: b.entry_uuid,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("finish captures", () => {
  it("captures with the time as sent, then assigns to a lane", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const made = await capture(session.uuid, 1, 12345);
    expect(made).toMatchObject({
      race_session_uuid: session.uuid,
      finish_order: 1,
      captured_time_ms: 12345,
      assignment_status: "UNASSIGNED",
      assigned_entry_uuid: null,
    });
    // Capture saja belum mengubah lane.
    expect((await detail(HEAT_1)).lanes[0].actions.finish).toBe(true);
    const assigned = await assign(made.uuid, lanes[0].entry_uuid);
    expect(assigned.assignment_status).toBe("ASSIGNED");
    // Mengulang assign yang sama aman (retry setelah jaringan putus).
    expect((await assign(made.uuid, lanes[0].entry_uuid)).uuid).toBe(made.uuid);
    expect((await detail(HEAT_1)).lanes[0].actions.finish).toBe(false);
  });

  it("is idempotent for a repeated client_request_id", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const first = await capture(session.uuid, 1, 1000, {
      client_request_id: "req-1",
    });
    const again = await capture(session.uuid, 1, 1000, {
      client_request_id: "req-1",
    });
    expect(again.uuid).toBe(first.uuid);
    expect(
      matchStore.captures.filter((c) => c.race_session_uuid === session.uuid),
    ).toHaveLength(1);
  });

  it("rejects bad bodies, a used finish_order and a session that is not running", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await expect(capture(session.uuid, 1, 1000)).rejects.toMatchObject({
      status: 409,
    });
    await start(session.uuid);
    await expect(capture(session.uuid, 0, 1000)).rejects.toMatchObject({
      status: 422,
    });
    await expect(capture(session.uuid, 1, -5)).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      call("POST", `/sessions/${session.uuid}/finishes`, {}),
    ).rejects.toMatchObject({
      status: 422,
      errors: {
        finish_order: expect.any(Array),
        captured_time_ms: expect.any(Array),
      },
    });
    await capture(session.uuid, 1, 1000);
    await expect(capture(session.uuid, 1, 2000)).rejects.toMatchObject({
      status: 422,
    });
    await stop(session.uuid);
    await expect(capture(session.uuid, 2, 3000)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("assigns only entries that are a lane of this match, once per session", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const other = (await detail(HEAT_2)).lanes[0];
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const one = await capture(session.uuid, 1, 1000);
    await expect(assign(one.uuid, other.entry_uuid)).rejects.toMatchObject({
      status: 422,
    });
    await expect(assign(one.uuid, "entry-nope")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      call("PATCH", `/finishes/${one.uuid}/assign`, {}),
    ).rejects.toMatchObject({ status: 422 });
    await assign(one.uuid, lanes[0].entry_uuid);
    const two = await capture(session.uuid, 2, 2000);
    await expect(assign(two.uuid, lanes[0].entry_uuid)).rejects.toMatchObject({
      status: 422,
    });
    // Capture kedua tertinggal UNASSIGNED sampai ditetapkan atau di-void.
    expect(
      matchStore.captures.find((c) => c.uuid === two.uuid)?.assignment_status,
    ).toBe("UNASSIGNED");
    await expect(assign("nope", lanes[1].entry_uuid)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("undoes a finish with void, then lets the lane finish again with a new finish_order", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const tapped = await tap(session.uuid, 1, 20000, lanes[0].entry_uuid);
    let match = await detail(HEAT_1);
    expect(match.lanes[0].actions.undo_finish).toBe(true);

    const voided = await call<ApiFinishCapture>(
      "POST",
      `/finishes/${tapped.uuid}/void`,
    );
    expect(voided).toMatchObject({
      assignment_status: "VOID",
      assigned_entry_uuid: null,
    });
    match = await detail(HEAT_1);
    expect(match.lanes[0].actions).toMatchObject({
      finish: true,
      undo_finish: false,
    });
    await expect(
      call("POST", `/finishes/${tapped.uuid}/void`),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      assign(tapped.uuid, lanes[0].entry_uuid),
    ).rejects.toMatchObject({ status: 422 });
    // finish_order 1 sudah terpakai oleh capture VOID: nomor berikutnya 2.
    await expect(capture(session.uuid, 1, 21000)).rejects.toMatchObject({
      status: 422,
    });
    await tap(session.uuid, 2, 21000, lanes[0].entry_uuid);
    expect((await detail(HEAT_1)).lanes[0].actions.undo_finish).toBe(true);
  });

  it("can undo a finish after the session stopped, but not after confirm", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const tapped = await tap(session.uuid, 1, 20000, lanes[0].entry_uuid);
    await stop(session.uuid);
    expect((await detail(HEAT_1)).lanes[0].actions.undo_finish).toBe(true);
    await confirm(HEAT_1);
    expect((await detail(HEAT_1)).lanes[0].actions.undo_finish).toBe(false);
    await expect(
      call("POST", `/finishes/${tapped.uuid}/void`),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("did not start (DNS)", () => {
  it("marks and unmarks a lane through its heat entry", async () => {
    await asOrganizer();
    const lane = (await detail(HEAT_1)).lanes[3];
    const marked = await setCallStatus(lane.uuid, "DNS");
    expect(marked).toMatchObject({
      uuid: lane.uuid,
      heat_uuid: HEAT_1,
      entry_uuid: lane.entry_uuid,
      lane_number: 4,
      call_status: "DNS",
      position: null,
      completed_time_ms: null,
    });
    let after = (await detail(HEAT_1)).lanes[3];
    expect(after.actions).toMatchObject({
      mark_dns: false,
      undo_dns: true,
      finish: false,
      disqualify: false,
    });
    await setCallStatus(lane.uuid, "WAITING");
    after = (await detail(HEAT_1)).lanes[3];
    expect(after.call_status).toBe("WAITING");
    expect(after.actions.mark_dns).toBe(true);
  });

  it("keeps a DNS lane out of the race and confirms it as DNS after the finishers", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    await setCallStatus(lanes[0].uuid, "DNS");
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const made = await capture(session.uuid, 1, 1000);
    await expect(assign(made.uuid, lanes[0].entry_uuid)).rejects.toMatchObject({
      status: 409,
    });
    await assign(made.uuid, lanes[1].entry_uuid);
    await expect(disqualify(lanes[0].entry_uuid)).rejects.toMatchObject({
      status: 409,
    });
    await stop(session.uuid);
    const done = await confirm(HEAT_1);
    expect(
      done.lanes.map((l) => [l.lane_number, l.call_status, l.position]),
    ).toEqual([
      [1, "DNS", 4],
      [2, "FINISHED", 1],
      [3, "DNF", 2],
      [4, "DNF", 3],
    ]);
  });

  it("needs the finish undone first, and a valid status", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const tapped = await tap(session.uuid, 1, 1000, lanes[0].entry_uuid);
    await expect(setCallStatus(lanes[0].uuid, "DNS")).rejects.toMatchObject({
      status: 409,
    });
    await call("POST", `/finishes/${tapped.uuid}/void`);
    expect((await setCallStatus(lanes[0].uuid, "DNS")).call_status).toBe("DNS");
    await expect(setCallStatus(lanes[0].uuid, "BOGUS")).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      call("PATCH", `/heat-entries/${lanes[0].uuid}`, { position: 1 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(setCallStatus("nope", "DNS")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("cannot change after the match is confirmed", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await stop(session.uuid);
    await confirm(HEAT_1);
    await expect(setCallStatus(lanes[0].uuid, "DNS")).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("disqualify (penalty)", () => {
  it("issues a DISQUALIFICATION penalty, shown on the lane, and confirms the lane as DQ", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await expect(disqualify(lanes[0].entry_uuid)).rejects.toMatchObject({
      status: 409,
    });
    await start(session.uuid);
    const penalty = await disqualify(lanes[0].entry_uuid, "Left the lane");
    expect(penalty).toMatchObject({
      entry_uuid: lanes[0].entry_uuid,
      attempt_uuid: null,
      penalty_type: "DISQUALIFICATION",
      penalty_value: "0.00",
      penalty_unit: "DISQUALIFICATION",
      reason: "Left the lane",
      status: "ACTIVE",
    });
    const match = await detail(HEAT_1);
    expect(match.lanes[0].penalties).toHaveLength(1);
    expect(match.lanes[0].actions).toMatchObject({
      finish: false,
      disqualify: false,
      undo_disqualify: true,
    });
    await expect(disqualify(lanes[0].entry_uuid)).rejects.toMatchObject({
      status: 409,
    });
    await tap(session.uuid, 1, 30000, lanes[1].entry_uuid);
    await stop(session.uuid);
    const done = await confirm(HEAT_1);
    expect(
      done.lanes.map((l) => [l.lane_number, l.call_status, l.position]),
    ).toEqual([
      [1, "DQ", 4],
      [2, "FINISHED", 1],
      [3, "DNF", 2],
      [4, "DNF", 3],
    ]);
  });

  it("disqualifies a lane that already finished, and revoking brings the finish back", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await tap(session.uuid, 1, 30000, lanes[0].entry_uuid);
    const penalty = await disqualify(lanes[0].entry_uuid);
    await stop(session.uuid);
    let preview = matchOutcomes(fromApi(await detail(HEAT_1)));
    expect(preview.find((o) => o.position === 1)?.status).not.toBe("FINISHED");
    const revoked = await call<ApiPenalty>(
      "POST",
      `/penalties/${penalty.uuid}/revoke`,
    );
    expect(revoked.status).toBe("REVOKED");
    await expect(
      call("POST", `/penalties/${penalty.uuid}/revoke`),
    ).rejects.toMatchObject({ status: 422 });
    preview = matchOutcomes(fromApi(await detail(HEAT_1)));
    expect(preview[0]).toMatchObject({
      status: "FINISHED",
      completedTimeMs: 30000,
    });
    await confirm(HEAT_1);
  });

  it("validates the penalty body, the unit and the entry", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    const url = `/entries/${lanes[0].entry_uuid}/penalties`;
    await expect(call("POST", url, {})).rejects.toMatchObject({
      status: 422,
      errors: {
        penalty_type: expect.any(Array),
        penalty_value: expect.any(Array),
        penalty_unit: expect.any(Array),
        reason: expect.any(Array),
      },
    });
    await expect(
      call("POST", url, {
        penalty_type: "TIME",
        penalty_value: 5000,
        penalty_unit: "MILLISECONDS",
        reason: "Touched the cone",
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(disqualify("entry-nope")).rejects.toMatchObject({
      status: 404,
    });
    await expect(call("POST", "/penalties/nope/revoke")).rejects.toMatchObject({
      status: 404,
    });
    await asCompetitor();
    await expect(disqualify(lanes[0].entry_uuid)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("POST /heats/{uuid}/confirm", () => {
  it("needs a stopped session and cannot run twice", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await expect(confirm(HEAT_1)).rejects.toMatchObject({ status: 409 });
    await start(session.uuid);
    await expect(confirm(HEAT_1)).rejects.toMatchObject({ status: 409 });
    await stop(session.uuid);
    await confirm(HEAT_1);
    await expect(confirm(HEAT_1)).rejects.toMatchObject({ status: 409 });
    await expect(
      newSession(HEAT_1, { session_number: 2 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("answers 403 and 404 before anything else", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await stop(session.uuid);
    const body = {
      ...confirmBody(matchOutcomes(fromApi(await detail(HEAT_1)))),
    };
    await asCompetitor();
    await expect(
      call("POST", `/heats/${HEAT_1}/confirm`, body),
    ).rejects.toMatchObject({ status: 403 });
    await asOrganizer();
    await expect(
      call("POST", "/heats/heat-nope/confirm", body),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("validates the body shape", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await stop(session.uuid);
    const lanes = (await detail(HEAT_1)).lanes;
    const url = `/heats/${HEAT_1}/confirm`;
    await expect(call("POST", url, {})).rejects.toMatchObject({ status: 422 });
    await expect(call("POST", url, { results: [] })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      call("POST", url, {
        results: [
          {
            heat_entry_uuid: lanes[0].uuid,
            position: 0,
            completed_time_ms: 100,
            status: "BOGUS",
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 422 });
    // FINISHED tanpa waktu, dan DNF dengan waktu.
    await expect(
      call("POST", url, {
        results: [
          {
            heat_entry_uuid: lanes[0].uuid,
            position: 1,
            completed_time_ms: null,
            status: "FINISHED",
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", url, {
        results: [
          {
            heat_entry_uuid: lanes[0].uuid,
            position: 1,
            completed_time_ms: 5,
            status: "DNF",
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("is atomic: a result list that is incomplete or wrong writes nothing and keeps the match open", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await tap(session.uuid, 1, 30000, lanes[0].entry_uuid);
    await stop(session.uuid);
    const good = matchOutcomes(fromApi(await detail(HEAT_1)));
    const url = `/heats/${HEAT_1}/confirm`;

    // Satu lane hilang dari daftar.
    await expect(
      call("POST", url, { ...confirmBody(good.slice(0, 3)) }),
    ).rejects.toMatchObject({ status: 422 });
    // Semua lane ada, tetapi satu hasil tidak sesuai finish tersimpan (lane 4 dibuat "finish").
    const tampered = good.map((o) =>
      o.heatEntryId === lanes[3].uuid
        ? { ...o, status: "FINISHED" as const, completedTimeMs: 100 }
        : o,
    );
    await expect(
      call("POST", url, { ...confirmBody(tampered) }),
    ).rejects.toMatchObject({ status: 422 });
    // Posisi dibalik.
    const swapped = good.map((o) => ({ ...o, position: 5 - o.position }));
    await expect(
      call("POST", url, { ...confirmBody(swapped) }),
    ).rejects.toMatchObject({ status: 422 });

    const match = await detail(HEAT_1);
    expect(match.heat_status).toBe("IN_PROGRESS");
    expect(match.finished_at).toBeNull();
    expect(
      match.lanes.every(
        (l) =>
          l.call_status === "WAITING" &&
          l.position === null &&
          l.completed_time_ms === null,
      ),
    ).toBe(true);
    expect(match.actions.confirm).toBe(true);
    // Setelah itu hasil yang benar tetap bisa dikonfirmasi.
    expect((await confirm(HEAT_1)).status).toBe("DONE");
  });
});

describe("decision 0A: a locked drawing freezes check-in and withdraw", () => {
  const entriesOf = (competition: string) =>
    call<ApiEventEntries>(
      "GET",
      `/events/${JAKARTA}/entries?competition_id=${competition}&status=REGISTERED&per_page=100`,
    );

  it("rejects undo check-in for a drawn entry and hides the action", async () => {
    await asOrganizer();
    const sprint = (await entriesOf(SPRINT)).items;
    const drawn = sprint.filter((e) => e.checkin_status === "CHECKED_IN");
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((e) => e.actions.undo_check_in === false)).toBe(true);
    expect(drawn.every((e) => e.actions.withdraw === false)).toBe(true);
    await expect(
      call("POST", `/entries/${drawn[0].uuid}/undo-checkin`),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      store.entries.find((e) => e.uuid === drawn[0].uuid)?.checkin_status,
    ).toBe("CHECKED_IN");
  });

  it("still allows undo check-in where no drawing is locked", async () => {
    await asOrganizer();
    const derby = (await entriesOf(DERBY)).items.filter(
      (e) => e.checkin_status === "CHECKED_IN",
    );
    expect(derby.length).toBeGreaterThan(0);
    expect(derby[0].actions.undo_check_in).toBe(true);
    const undone = await call<{ checkin_status: string }>(
      "POST",
      `/entries/${derby[0].uuid}/undo-checkin`,
    );
    expect(undone.checkin_status).toBe("NOT_CHECKED_IN");
  });

  it("does not delete a drawn entry, but still deletes one outside the drawing", async () => {
    await asOrganizer();
    const sprint = (await entriesOf(SPRINT)).items;
    const drawn = sprint.find((e) => e.checkin_status === "CHECKED_IN");
    const outside = sprint.find((e) => e.checkin_status !== "CHECKED_IN");
    await expect(
      call("DELETE", `/entries/${drawn?.uuid}`),
    ).rejects.toMatchObject({ status: 422 });
    await call("DELETE", `/entries/${outside?.uuid}`);
    expect(store.entries.some((e) => e.uuid === outside?.uuid)).toBe(false);
  });

  it("unfreezes after the drawing is removed by reopening registration", async () => {
    await asOrganizer();
    const before = (await entriesOf(SPRINT)).items.find(
      (e) => e.checkin_status === "CHECKED_IN",
    );
    expect(before?.actions.undo_check_in).toBe(false);
    await call("POST", `/competitions/${SPRINT}/reopen-registration`);
    const after = (await entriesOf(SPRINT)).items.find(
      (e) => e.uuid === before?.uuid,
    );
    expect(after?.actions.undo_check_in).toBe(true);
  });
});

describe("drawing changes", () => {
  it("drops sessions, finishes and penalties when the drawing is removed", async () => {
    await asOrganizer();
    const lanes = (await detail(HEAT_1)).lanes;
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    await tap(session.uuid, 1, 1000, lanes[0].entry_uuid);
    await disqualify(lanes[1].entry_uuid);
    expect(matchStore.sessions).toHaveLength(1);
    await call("POST", `/competitions/${SPRINT}/reopen-registration`);
    expect(matchStore.sessions).toEqual([]);
    expect(matchStore.captures).toEqual([]);
    expect(matchStore.penalties).toEqual([]);
    expect((await list(SPRINT)).drawing_status).toBe("NOT_DRAWN");
    await expect(detail(HEAT_1)).rejects.toMatchObject({ status: 404 });
  });

  it("resetMatchStore brings back the seed: all matches not started", async () => {
    await asOrganizer();
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    resetMatchStore();
    expect(matchStore.sessions).toEqual([]);
    expect(drawingStore.drawings[SPRINT].matches.map((m) => m.status)).toEqual([
      "SCHEDULED",
      "SCHEDULED",
      "SCHEDULED",
    ]);
    expect(
      (await list(SPRINT)).items.every((m) => m.status === "NOT_STARTED"),
    ).toBe(true);
  });
});

describe("results integration", () => {
  const results = () =>
    call<ApiCompetitionResults>("GET", `/competitions/${SPRINT}/results`);

  it("has no results until a match is confirmed", async () => {
    await asOrganizer();
    expect((await results()).items).toEqual([]);
    // Match yang masih jalan belum menghasilkan baris.
    const session = await newSession(HEAT_1);
    await start(session.uuid);
    expect((await results()).items).toEqual([]);
  });

  it("builds the ranking from one confirmed match", async () => {
    await asOrganizer();
    const match = await runMatch(HEAT_1, {
      times: { 2: 31250, 1: 38412, 3: 40003 },
    });
    const data = await results();
    expect(data.items).toHaveLength(4);
    expect(
      data.items.map((r) => [r.entry_uuid, r.rank, r.status, r.finish_time_ms]),
    ).toEqual([
      [match.lanes[1].entry_uuid, 1, "FINISHED", 31250],
      [match.lanes[0].entry_uuid, 2, "FINISHED", 38412],
      [match.lanes[2].entry_uuid, 3, "FINISHED", 40003],
      [match.lanes[3].entry_uuid, 4, "DNF", null],
    ]);
    expect(data.items[0].pet_name).toBeTruthy();
    expect(data.items[0].bib_number).toBeTruthy();
  });

  it("merges confirmed matches into one ranking by time, then DNF, DQ and DNS", async () => {
    await asOrganizer();
    const first = await runMatch(HEAT_1, {
      dnsLanes: [3],
      times: { 1: 30000, 2: 35000 },
    });
    const second = await runMatch(HEAT_2, {
      dnsLanes: [4],
      dqLanes: [2],
      times: { 1: 32000, 3: 34000 },
    });
    const data = await results();
    const lane = (m: ApiMatch, n: number) => m.lanes[n - 1].entry_uuid;
    expect(data.items.map((r) => [r.entry_uuid, r.rank, r.status])).toEqual([
      [lane(first, 1), 1, "FINISHED"], // 30000
      [lane(second, 1), 2, "FINISHED"], // 32000
      [lane(second, 3), 3, "FINISHED"], // 34000
      [lane(first, 2), 4, "FINISHED"], // 35000
      [lane(first, 4), 5, "DNF"],
      [lane(second, 2), 6, "DQ"],
      [lane(first, 3), 7, "DNS"],
      [lane(second, 4), 8, "DNS"],
    ]);
    expect(
      data.items
        .filter((r) => r.status !== "FINISHED")
        .map((r) => r.finish_time_ms),
    ).toEqual([null, null, null, null]);
    // Match ke-3 belum dikonfirmasi: pesertanya belum masuk klasemen.
    expect(data.items).toHaveLength(8);
  });

  it("keeps the seeded results of other competitions", async () => {
    await asOrganizer();
    await runMatch(HEAT_1, { times: { 1: 30000 } });
    const funRun = await call<ApiCompetitionResults>(
      "GET",
      "/competitions/comp-puppy-fun-run/results",
    );
    expect(funRun.items).toHaveLength(6);
    expect(funRun.items.some((r) => r.status === "DNF")).toBe(true);
  });
});
