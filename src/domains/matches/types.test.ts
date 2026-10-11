import { describe, expect, it } from "vitest";
import {
  fromApi,
  listFromApi,
  penaltyFromApi,
  sessionFromApi,
  type ApiMatch,
  type ApiMatchLane,
  type ApiMatchList,
  type ApiRaceSession,
} from "./types";

const noActions = {
  finish: false,
  undo_finish: false,
  mark_dns: false,
  undo_dns: false,
  disqualify: false,
  undo_disqualify: false,
};

const lane = (n: number, over: Partial<ApiMatchLane> = {}): ApiMatchLane => ({
  uuid: `he${n}`,
  heat_uuid: "h1",
  entry_uuid: `e${n}`,
  lane_number: n,
  start_order: n,
  call_status: "WAITING",
  distance_to_finish: null,
  completed_time_ms: null,
  position: null,
  cot_flag: false,
  pet_name: `Pet ${n}`,
  pet_morph_name: "Caramel",
  owner_name: "Owner",
  bib_number: `00${n}`,
  penalties: [],
  actions: noActions,
  ...over,
});

const session = (
  n: number,
  over: Partial<ApiRaceSession> = {},
): ApiRaceSession => ({
  uuid: `s${n}`,
  heat_uuid: "h1",
  session_number: n,
  rematch_of_session_uuid: null,
  countdown_seconds: 3,
  cutoff_time_ms: 90000,
  started_at: null,
  stopped_at: null,
  stop_reason: null,
  status: "READY",
  finish_captures: [],
  ...over,
});

const capture = (
  uuid: string,
  order: number,
  entry: string | null,
  status: "ASSIGNED" | "UNASSIGNED" | "VOID",
  ms = 30000,
) => ({
  uuid,
  race_session_uuid: "s2",
  finish_order: order,
  captured_time_ms: ms,
  assigned_entry_uuid: entry,
  captured_by_uuid: "u1",
  captured_at: "2026-10-11T08:00:00+00:00",
  assignment_status: status,
  assigned_by_uuid: null,
  assigned_at: null,
});

const apiMatch: ApiMatch = {
  uuid: "h1",
  competition_uuid: "c1",
  round_uuid: "r1",
  match_number: 2,
  total_matches: 3,
  purpose: "NORMAL",
  arena_name: null,
  scheduled_at: null,
  started_at: "2026-10-11T08:00:00+00:00",
  finished_at: null,
  heat_status: "IN_PROGRESS",
  status: "RUNNING",
  session_defaults: { countdown_seconds: 3, cutoff_time_ms: 90000 },
  // Sengaja tidak berurutan: mapper harus mengurutkan lane dan sesi.
  lanes: [
    lane(2, { pet_name: null, pet_morph_name: null, bib_number: null }),
    lane(1, {
      penalties: [
        {
          uuid: "p1",
          entry_uuid: "e1",
          attempt_uuid: null,
          penalty_type: "DISQUALIFICATION",
          penalty_value: "0.00",
          penalty_unit: "DISQUALIFICATION",
          reason: "False start",
          issued_by_uuid: "u1",
          issued_at: "2026-10-11T08:01:00+00:00",
          status: "REVOKED",
        },
      ],
      actions: { ...noActions, finish: true, undo_dns: true },
    }),
    lane(3),
  ],
  sessions: [
    session(2, {
      status: "RUNNING",
      rematch_of_session_uuid: "s1",
      finish_captures: [
        capture("c2", 2, "e3", "ASSIGNED", 41000),
        capture("c1", 1, "e1", "ASSIGNED", 38412),
        capture("c0", 3, null, "VOID", 50000),
      ],
    }),
    session(1, { status: "REMATCHED" }),
  ],
  current_session_uuid: "s2",
  actions: {
    create_session: false,
    start: false,
    finish: true,
    stop: true,
    rematch: true,
    mark_dns: true,
    disqualify: true,
    confirm: false,
  },
};

describe("fromApi (match detail)", () => {
  const match = fromApi(apiMatch);

  it("maps the header and the flags to camelCase", () => {
    expect(match).toMatchObject({
      id: "h1",
      competitionId: "c1",
      number: 2,
      totalMatches: 3,
      status: "RUNNING",
      heatStatus: "IN_PROGRESS",
      sessionDefaults: { countdownSeconds: 3, cutoffTimeMs: 90000 },
      actions: {
        createSession: false,
        finish: true,
        stop: true,
        rematch: true,
        markDns: true,
        disqualify: true,
        confirm: false,
      },
    });
  });

  it("orders lanes and sessions, and finds the current session", () => {
    expect(match.lanes.map((l) => l.laneNumber)).toEqual([1, 2, 3]);
    expect(match.sessions.map((s) => s.number)).toEqual([1, 2]);
    expect(match.currentSession?.id).toBe("s2");
    expect(match.currentSession?.captures.map((c) => c.finishOrder)).toEqual([
      1, 2, 3,
    ]);
  });

  it("takes each lane finish from the ASSIGNED capture of the current session only", () => {
    expect(match.lanes[0].finish).toEqual({
      captureId: "c1",
      finishOrder: 1,
      capturedTimeMs: 38412,
    });
    expect(match.lanes[1].finish).toBeNull();
    expect(match.lanes[2].finish?.capturedTimeMs).toBe(41000);
  });

  it("falls back for names and keeps an inactive penalty out of disqualification", () => {
    expect(match.lanes[1]).toMatchObject({
      petName: "Unnamed pet",
      petMorphName: "",
      bibNumber: "",
    });
    expect(match.lanes[0].penalties).toHaveLength(1);
    expect(match.lanes[0].disqualification).toBeNull();
    expect(match.lanes[0].actions).toEqual({
      finish: true,
      undoFinish: false,
      markDns: false,
      undoDns: true,
      disqualify: false,
      undoDisqualify: false,
    });
  });

  it("has no current session when the API sends none", () => {
    const bare = fromApi({
      ...apiMatch,
      sessions: [],
      current_session_uuid: null,
    });
    expect(bare.currentSession).toBeNull();
    expect(bare.lanes.every((l) => l.finish === null)).toBe(true);
  });

  it("reads an active DISQUALIFICATION as the lane disqualification", () => {
    const penalized = fromApi({
      ...apiMatch,
      lanes: [
        lane(1, {
          penalties: [
            {
              uuid: "p2",
              entry_uuid: "e1",
              attempt_uuid: null,
              penalty_type: "DISQUALIFICATION",
              penalty_value: "0.00",
              penalty_unit: "DISQUALIFICATION",
              reason: "Left the lane",
              issued_by_uuid: "u1",
              issued_at: "2026-10-11T08:02:00+00:00",
              status: "ACTIVE",
            },
          ],
        }),
      ],
    });
    expect(penalized.lanes[0].disqualification).toMatchObject({
      id: "p2",
      reason: "Left the lane",
      value: 0,
    });
  });
});

describe("sessionFromApi and penaltyFromApi", () => {
  it("maps a session with its captures", () => {
    const mapped = sessionFromApi(
      session(1, {
        status: "FINISHED",
        stop_reason: "ALL_FINISHED",
        started_at: "2026-10-11T08:00:00+00:00",
        stopped_at: "2026-10-11T08:01:00+00:00",
        finish_captures: [capture("c1", 1, "e1", "UNASSIGNED")],
      }),
    );
    expect(mapped).toMatchObject({
      id: "s1",
      matchId: "h1",
      number: 1,
      status: "FINISHED",
      stopReason: "ALL_FINISHED",
      cutoffTimeMs: 90000,
      captures: [
        {
          id: "c1",
          sessionId: "s2",
          assignmentStatus: "UNASSIGNED",
          assignedEntryId: "e1",
        },
      ],
    });
  });

  it("turns the decimal penalty value string into a number", () => {
    expect(
      penaltyFromApi({
        uuid: "p1",
        entry_uuid: "e1",
        attempt_uuid: null,
        penalty_type: "TIME",
        penalty_value: "5000.50",
        penalty_unit: "MILLISECONDS",
        reason: "Cone",
        issued_by_uuid: "u1",
        issued_at: "2026-10-11T08:00:00+00:00",
        status: "ACTIVE",
      }).value,
    ).toBe(5000.5);
  });
});

describe("listFromApi", () => {
  const api: ApiMatchList = {
    competition_uuid: "c1",
    drawing_status: "LOCKED",
    items: [
      {
        uuid: "h2",
        match_number: 2,
        status: "NOT_STARTED",
        heat_status: "SCHEDULED",
        planned_lanes: [
          {
            lane_number: 2,
            entry_uuid: "e2",
            pet_name: null,
            owner_name: "B",
            bib_number: null,
          },
          {
            lane_number: 1,
            entry_uuid: "e1",
            pet_name: "Chibi",
            owner_name: "A",
            bib_number: "001",
          },
        ],
        current_session: null,
        session_count: 0,
      },
      {
        uuid: "h1",
        match_number: 1,
        status: "DONE",
        heat_status: "COMPLETED",
        planned_lanes: [],
        current_session: { uuid: "s1", session_number: 1, status: "FINISHED" },
        session_count: 1,
      },
    ],
  };

  it("orders matches, counts the done ones and points to the next", () => {
    const list = listFromApi(api);
    expect(list.items.map((m) => m.number)).toEqual([1, 2]);
    expect(list.doneCount).toBe(1);
    expect(list.nextMatchId).toBe("h2");
    expect(list.drawingLocked).toBe(true);
    expect(list.items[0].currentSession).toEqual({
      id: "s1",
      number: 1,
      status: "FINISHED",
    });
    expect(list.items[1].plannedLanes).toEqual([
      {
        laneNumber: 1,
        entryId: "e1",
        petName: "Chibi",
        ownerName: "A",
        bibNumber: "001",
      },
      {
        laneNumber: 2,
        entryId: "e2",
        petName: "Unnamed pet",
        ownerName: "B",
        bibNumber: "",
      },
    ]);
  });

  it("has no next match when everything is done or the drawing is not locked", () => {
    expect(
      listFromApi({
        ...api,
        items: [api.items[1]],
      }).nextMatchId,
    ).toBeNull();
    const empty = listFromApi({
      competition_uuid: "c1",
      drawing_status: "NOT_DRAWN",
      items: [],
    });
    expect(empty).toMatchObject({
      drawingLocked: false,
      items: [],
      doneCount: 0,
      nextMatchId: null,
    });
  });
});
