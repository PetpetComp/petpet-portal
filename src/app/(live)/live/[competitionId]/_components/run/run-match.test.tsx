import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  AssignFinishError,
  assignFinish,
  captureAndAssign,
  confirmMatch,
  createSession,
  disqualify,
  getMatch,
  getMatches,
  markDns,
  newClientRequestId,
  startSession,
  stopSession,
  voidFinish,
} from "@/domains/matches/api";
import type {
  CallStatus,
  FinishCapture,
  Match,
  MatchLane,
  MatchList,
  MatchSummary,
  RaceSession,
} from "@/domains/matches/types";
import { ApiError } from "@/lib/api-client";
import { RunMatch } from "./run-match";

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));
vi.mock("@/domains/matches/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/matches/api")>()),
  getMatch: vi.fn(),
  getMatches: vi.fn(),
  createSession: vi.fn(),
  startSession: vi.fn(),
  stopSession: vi.fn(),
  captureAndAssign: vi.fn(),
  assignFinish: vi.fn(),
  voidFinish: vi.fn(),
  markDns: vi.fn(),
  disqualify: vi.fn(),
  revokePenalty: vi.fn(),
  confirmMatch: vi.fn(),
  newClientRequestId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Server palsu di memori: meniru aturan backend secukupnya (flag `actions`, status sesi).
// ---------------------------------------------------------------------------

const NO_ACTIONS = {
  createSession: false,
  start: false,
  finish: false,
  stop: false,
  rematch: false,
  markDns: false,
  disqualify: false,
  confirm: false,
};

let server: Match;
let captureCounter = 0;
let hasNextMatch = true;

/** Satu lane menunggu; `actions` dihitung ulang oleh `sync`. */
function makeLane(n: number, pet: string): MatchLane {
  return {
    heatEntryId: `he${n}`,
    entryId: `e${n}`,
    laneNumber: n,
    petName: pet,
    petMorphName: "Caramel",
    ownerName: `Owner${n}`,
    bibNumber: `10${n}`,
    callStatus: "WAITING",
    position: null,
    completedTimeMs: null,
    finish: null,
    penalties: [],
    disqualification: null,
    actions: {
      finish: false,
      undoFinish: false,
      markDns: false,
      undoDns: false,
      disqualify: false,
      undoDisqualify: false,
    },
  };
}

/**
 * Menghitung ulang bagian turunan match: sesi yang berlaku, finish tiap lane, dan semua flag
 * `actions` menurut status sesi (sama dengan aturan di kontrak). Dipanggil setelah tiap mutasi palsu.
 */
function sync(m: Match): Match {
  const current =
    [...m.sessions].reverse().find((s) => s.status !== "REMATCHED") ?? null;
  const status = current?.status ?? null;
  const done = m.heatStatus === "COMPLETED";
  const started =
    status === "RUNNING" || status === "FINISHED" || status === "CUTOFF";
  const stopped = status === "FINISHED" || status === "CUTOFF";
  return {
    ...m,
    currentSession: current,
    actions: done
      ? NO_ACTIONS
      : {
          createSession: current === null,
          start: status === "READY",
          finish: status === "RUNNING",
          stop: status === "RUNNING",
          rematch: started,
          markDns: true,
          disqualify: started,
          confirm: stopped,
        },
    lanes: m.lanes.map((lane) => {
      const capture = current?.captures.find(
        (c) =>
          c.assignmentStatus === "ASSIGNED" &&
          c.assignedEntryId === lane.entryId,
      );
      const finish = capture
        ? {
            captureId: capture.id,
            finishOrder: capture.finishOrder,
            capturedTimeMs: capture.capturedTimeMs,
          }
        : null;
      const waiting = lane.callStatus === "WAITING";
      return {
        ...lane,
        finish,
        actions: done
          ? { ...lane.actions, finish: false, undoFinish: false }
          : {
              finish:
                status === "RUNNING" &&
                waiting &&
                !finish &&
                !lane.disqualification,
              undoFinish: finish !== null && started,
              markDns: waiting && !finish && !lane.disqualification,
              undoDns: lane.callStatus === "DNS",
              disqualify: started && waiting && !lane.disqualification,
              undoDisqualify: lane.disqualification !== null,
            },
      };
    }),
  };
}

/** Match nomor 2 dari 3 yang belum dimulai (dua lane: Niko dan Kona). */
function baseMatch(
  sessionDefaults = { countdownSeconds: 0, cutoffTimeMs: 90000 },
): Match {
  return sync({
    id: "h2",
    competitionId: "c1",
    number: 2,
    totalMatches: 3,
    status: "NOT_STARTED",
    heatStatus: "SCHEDULED",
    startedAt: null,
    finishedAt: null,
    sessionDefaults,
    lanes: [makeLane(1, "Niko"), makeLane(2, "Kona")],
    sessions: [],
    currentSession: null,
    actions: NO_ACTIONS,
  });
}

/** Mengganti satu sesi (tidak mengubah yang lama) lalu menghitung ulang. */
function updateSession(id: string, patch: Partial<RaceSession>): RaceSession {
  server = sync({
    ...server,
    sessions: server.sessions.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    ),
  });
  return server.sessions.find((s) => s.id === id)!;
}

function pushCapture(sessionId: string, capture: FinishCapture) {
  const session = server.sessions.find((s) => s.id === sessionId)!;
  updateSession(sessionId, { captures: [...session.captures, capture] });
}

/** Daftar match untuk useMatches: match ini ditambah satu match berikutnya bila `hasNextMatch`. */
function matchList(): MatchList {
  const own: MatchSummary = {
    id: server.id,
    number: server.number,
    status: server.status,
    heatStatus: server.heatStatus,
    plannedLanes: [],
    currentSession: null,
    sessionCount: server.sessions.length,
  };
  const items: MatchSummary[] = hasNextMatch
    ? [
        own,
        {
          ...own,
          id: "h3",
          number: 3,
          status: "NOT_STARTED",
          heatStatus: "SCHEDULED",
        },
      ]
    : [own];
  return {
    competitionId: "c1",
    drawingLocked: true,
    items,
    doneCount: items.filter((m) => m.status === "DONE").length,
    nextMatchId: items.find((m) => m.status !== "DONE")?.id ?? null,
  };
}

/** Memasang implementasi palsu semua fungsi API. Dipanggil di beforeEach. */
function installFakeApi() {
  vi.mocked(getMatch).mockImplementation(async () => server);
  vi.mocked(getMatches).mockImplementation(async () => matchList());
  vi.mocked(createSession).mockImplementation(async (_matchId, input) => {
    const old = input.rematchOfSessionId
      ? server.sessions.find((s) => s.id === input.rematchOfSessionId)
      : null;
    const session: RaceSession = {
      id: `s${input.sessionNumber}`,
      matchId: server.id,
      number: input.sessionNumber,
      rematchOfId: old?.id ?? null,
      countdownSeconds: input.countdownSeconds,
      cutoffTimeMs: input.cutoffTimeMs,
      startedAt: null,
      stoppedAt: null,
      stopReason: null,
      status: "READY",
      captures: [],
    };
    server = sync({
      ...server,
      sessions: [
        ...server.sessions.map((s) =>
          s.id === old?.id ? { ...s, status: "REMATCHED" as const } : s,
        ),
        session,
      ],
    });
    return session;
  });
  vi.mocked(startSession).mockImplementation(async (sessionId) => {
    const session = updateSession(sessionId, {
      status: "RUNNING",
      startedAt: new Date().toISOString(),
    });
    server = sync({ ...server, heatStatus: "IN_PROGRESS", status: "RUNNING" });
    return session;
  });
  vi.mocked(stopSession).mockImplementation(async (sessionId, reason) =>
    updateSession(sessionId, {
      status: reason === "CUTOFF" ? "CUTOFF" : "FINISHED",
      stopReason: reason,
      stoppedAt: new Date().toISOString(),
    }),
  );
  vi.mocked(captureAndAssign).mockImplementation(async (input) => {
    captureCounter += 1;
    const capture: FinishCapture = {
      id: `cap${captureCounter}`,
      sessionId: input.sessionId,
      finishOrder: input.finishOrder,
      capturedTimeMs: input.capturedTimeMs,
      assignedEntryId: input.entryId,
      assignmentStatus: "ASSIGNED",
      capturedAt: "2026-10-11T08:00:00+00:00",
    };
    pushCapture(input.sessionId, capture);
    return capture;
  });
  vi.mocked(assignFinish).mockImplementation(async (captureId, entryId) => {
    const capture: FinishCapture = {
      id: captureId,
      sessionId: server.currentSession!.id,
      finishOrder: 1,
      capturedTimeMs: 3000,
      assignedEntryId: entryId,
      assignmentStatus: "ASSIGNED",
      capturedAt: "2026-10-11T08:00:00+00:00",
    };
    pushCapture(server.currentSession!.id, capture);
    return capture;
  });
  vi.mocked(voidFinish).mockImplementation(async (captureId) => {
    const session = server.currentSession!;
    updateSession(session.id, {
      captures: session.captures.map((c) =>
        c.id === captureId ? { ...c, assignmentStatus: "VOID" as const } : c,
      ),
    });
    return {} as FinishCapture;
  });
  vi.mocked(markDns).mockImplementation(async (heatEntryId, dns) => {
    server = sync({
      ...server,
      lanes: server.lanes.map((l) =>
        l.heatEntryId === heatEntryId
          ? { ...l, callStatus: dns ? "DNS" : "WAITING" }
          : l,
      ),
    });
    return {} as never;
  });
  vi.mocked(disqualify).mockImplementation(async (entryId, reason) => {
    const penalty = {
      id: "pen1",
      entryId,
      type: "DISQUALIFICATION",
      unit: "DISQUALIFICATION" as const,
      value: 0,
      reason,
      status: "ACTIVE" as const,
      issuedAt: "2026-10-11T08:00:00+00:00",
    };
    server = sync({
      ...server,
      lanes: server.lanes.map((l) =>
        l.entryId === entryId
          ? { ...l, penalties: [penalty], disqualification: penalty }
          : l,
      ),
    });
    return penalty;
  });
  vi.mocked(confirmMatch).mockImplementation(async (_matchId, outcomes) => {
    server = sync({
      ...server,
      heatStatus: "COMPLETED",
      status: "DONE",
      lanes: server.lanes.map((lane) => {
        const outcome = outcomes.find(
          (o) => o.heatEntryId === lane.heatEntryId,
        );
        return outcome
          ? {
              ...lane,
              callStatus: outcome.status as CallStatus,
              position: outcome.position,
              completedTimeMs: outcome.completedTimeMs,
            }
          : lane;
      }),
    });
    return server;
  });
}

// ---------------------------------------------------------------------------
// Pembantu tes
// ---------------------------------------------------------------------------

/** Jam tes: Date.now, yang dikendalikan fake timers. */
const testClock = () => Date.now();

/** Mengatur navigator.onLine untuk satu tes. */
function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

/** Memajukan waktu palsu (juga menjalankan promise yang menunggu) di dalam act. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Menunggu rantai promise dan refetch selesai tanpa memajukan jam. */
async function settle() {
  for (let i = 0; i < 8; i += 1) await advance(0);
}

async function click(element: HTMLElement) {
  fireEvent.click(element);
  await settle();
}

/**
 * Render layar, tunggu data muncul dengan timer asli (waitFor tidak jalan di fake timers),
 * lalu pindah ke fake timers. rAF diganti setTimeout 16 ms supaya ikut dikendalikan.
 */
async function renderRun(sessionDefaults?: {
  countdownSeconds: number;
  cutoffTimeMs: number;
}) {
  if (sessionDefaults) server = baseMatch(sessionDefaults);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RunMatch competitionId="c1" matchId="h2" clock={testClock} />
    </QueryClientProvider>,
  );
  await screen.findByRole("region", { name: "Lane 1" });
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
}

const lane = (n: number) => screen.getByRole("region", { name: `Lane ${n}` });
const timerText = () => screen.getByRole("timer");
const statusText = () => screen.getByTestId("timer-status");
const button = (name: string | RegExp) => screen.getByRole("button", { name });

/** Start match dengan hitung mundur 0: sesi dibuat, dimulai, timer langsung berjalan. */
async function startRace() {
  await click(button("Start match"));
  await settle();
}

beforeEach(() => {
  server = baseMatch();
  captureCounter = 0;
  hasNextMatch = true;
  let requestCounter = 0;
  nav.push.mockReset();
  vi.mocked(toast).mockReset();
  vi.mocked(newClientRequestId).mockImplementation(
    () => `req-${(requestCounter += 1)}`,
  );
  setOnLine(true);
  installFakeApi();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setOnLine(true);
});

describe("RunMatch: before the start", () => {
  it("shows the header pill, cut-off, ready status and disabled Finish buttons", async () => {
    await renderRun({ countdownSeconds: 3, cutoffTimeMs: 90000 });
    expect(screen.getByText("Round 1 - Match 2/3")).toBeInTheDocument();
    expect(screen.getByText("01:30")).toBeInTheDocument();
    expect(screen.getByText("OFFICIAL RACE TIMER")).toBeInTheDocument();
    expect(timerText()).toHaveTextContent("00:00.000");
    expect(statusText()).toHaveTextContent("Ready - countdown 3-2-1 is on");
    expect(button("Start match")).toBeEnabled();
    expect(button("Confirm result")).toBeDisabled();
    for (const finish of screen.getAllByRole("button", { name: "Finish" }))
      expect(finish).toBeDisabled();
    expect(within(lane(1)).getByText("Niko")).toBeInTheDocument();
    expect(within(lane(1)).getByText("Owner1 - Caramel")).toBeInTheDocument();
  });

  it("shows an inline error with a retry when the session cannot be created", async () => {
    await renderRun();
    vi.mocked(createSession).mockRejectedValueOnce(
      new ApiError(409, "Competition is not ongoing."),
    );
    await click(button("Start match"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Competition is not ongoing. Press Start match to try again.",
    );
    expect(button("Start match")).toBeEnabled();
    await startRace();
    expect(statusText()).toHaveTextContent("Running");
  });
});

describe("RunMatch: start, countdown, running, finish and undo", () => {
  it("counts down 3-2-1, starts the session, then runs the timer", async () => {
    await renderRun({ countdownSeconds: 3, cutoffTimeMs: 90000 });
    await click(button("Start match"));
    expect(createSession).toHaveBeenCalledWith("h2", {
      sessionNumber: 1,
      countdownSeconds: 3,
      cutoffTimeMs: 90000,
    });
    expect(statusText()).toHaveTextContent("Countdown 3..2..1");
    expect(timerText()).toHaveTextContent("3");
    await advance(1100);
    expect(timerText()).toHaveTextContent("2");
    expect(startSession).not.toHaveBeenCalled();
    await advance(1900);
    await settle();
    expect(startSession).toHaveBeenCalledWith("s1");
    expect(statusText()).toHaveTextContent("Running");
    expect(timerText()).toHaveTextContent(/^00:00\.\d{3}$/);
    expect(
      within(lane(1)).getByRole("button", { name: "Finish" }),
    ).toBeEnabled();
    await advance(1100);
    expect(timerText()).toHaveTextContent(/^00:01\.0\d{2}$/);
  });

  it("finishes a lane with the time seen at the tap, shows rank, announces it, and undoes it", async () => {
    await renderRun();
    await startRace();
    await advance(12345);
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));

    expect(captureAndAssign).toHaveBeenCalledTimes(1);
    expect(captureAndAssign).toHaveBeenCalledWith({
      sessionId: "s1",
      finishOrder: 1,
      capturedTimeMs: 12345,
      entryId: "e1",
      clientRequestId: "req-1",
    });
    expect(within(lane(1)).getByText("00:12.345")).toBeInTheDocument();
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();
    expect(within(lane(1)).getByText("1st so far")).toBeInTheDocument();
    expect(
      screen.getByText("Niko finished lane 1 in 00:12.345"),
    ).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      "Niko finished",
      expect.objectContaining({ duration: 5000 }),
    );
    // Lane lain tetap bisa finish; yang sudah finish tidak punya tombol Finish lagi.
    expect(
      within(lane(1)).queryByRole("button", { name: "Finish" }),
    ).toBeNull();
    expect(
      within(lane(2)).getByRole("button", { name: "Finish" }),
    ).toBeEnabled();

    await click(within(lane(1)).getByRole("button", { name: "Undo" }));
    expect(voidFinish).toHaveBeenCalledWith("cap1");
    expect(within(lane(1)).queryByText("Finished")).toBeNull();
    expect(
      within(lane(1)).getByRole("button", { name: "Finish" }),
    ).toBeEnabled();
  });

  it("undoes a finish from the 5 second toast action", async () => {
    await renderRun();
    await startRace();
    await advance(3000);
    await click(within(lane(2)).getByRole("button", { name: "Finish" }));
    expect(within(lane(2)).getByText("Finished")).toBeInTheDocument();

    const options = vi.mocked(toast).mock.calls.at(-1)?.[1] as unknown as {
      action: { onClick: () => void };
    };
    await act(async () => {
      options.action.onClick();
    });
    await settle();
    expect(voidFinish).toHaveBeenCalledWith("cap1");
    expect(within(lane(2)).queryByText("Finished")).toBeNull();
  });

  it("stops by itself when every lane is resolved and confirms through the summary dialog", async () => {
    await renderRun();
    await startRace();
    await advance(12345);
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));
    await advance(7655);
    await click(within(lane(2)).getByRole("button", { name: "Finish" }));

    expect(stopSession).toHaveBeenCalledWith("s1", "ALL_FINISHED");
    expect(statusText()).toHaveTextContent("Finished");
    expect(timerText()).toHaveTextContent("00:20.000");
    expect(button("Confirm result")).toBeEnabled();

    await click(button("Confirm result"));
    const dialog = screen.getByRole("dialog");
    const rows = within(dialog).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("1");
    expect(rows[1]).toHaveTextContent("Niko");
    expect(rows[1]).toHaveTextContent("Owner1");
    expect(rows[1]).toHaveTextContent("00:12.345");
    expect(rows[2]).toHaveTextContent("Kona");
    expect(rows[2]).toHaveTextContent("00:20.000");
    expect(confirmMatch).not.toHaveBeenCalled();

    await click(within(dialog).getByRole("button", { name: "Confirm result" }));
    expect(confirmMatch).toHaveBeenCalledWith("h2", [
      {
        heatEntryId: "he1",
        position: 1,
        status: "FINISHED",
        completedTimeMs: 12345,
      },
      {
        heatEntryId: "he2",
        position: 2,
        status: "FINISHED",
        completedTimeMs: 20000,
      },
    ]);
    expect(toast.success).toHaveBeenCalledWith("Match 2 confirmed");
    expect(nav.push).toHaveBeenCalledWith("/live/c1/matches");
  });

  it("shows a link to Results after the last match is confirmed", async () => {
    hasNextMatch = false;
    await renderRun();
    await startRace();
    await advance(1000);
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));
    await click(within(lane(2)).getByRole("button", { name: "Finish" }));
    await click(button("Confirm result"));
    await click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirm result",
      }),
    );
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "View results" })).toHaveAttribute(
      "href",
      "/live/c1/results",
    );
    // Match sekarang selesai: hanya baca.
    expect(screen.queryByRole("button", { name: "Rematch" })).toBeNull();
  });

  it("stops at the cut-off, marks unfinished lanes DNF and keeps the time frozen", async () => {
    await renderRun({ countdownSeconds: 0, cutoffTimeMs: 5000 });
    await startRace();
    await advance(2000);
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));
    await advance(3000);
    await settle();

    expect(stopSession).toHaveBeenCalledWith("s1", "CUTOFF");
    expect(statusText()).toHaveTextContent("Cut-off reached");
    expect(timerText()).toHaveTextContent("00:05.000");
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();
    expect(within(lane(2)).getByText("DNF")).toBeInTheDocument();
    await advance(5000);
    expect(timerText()).toHaveTextContent("00:05.000");
    expect(button("Confirm result")).toBeEnabled();
  });

  it("stops manually after a confirmation", async () => {
    await renderRun();
    await startRace();
    await advance(4000);
    await click(button("Stop match"));
    expect(stopSession).not.toHaveBeenCalled();
    await click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Stop match",
      }),
    );
    expect(stopSession).toHaveBeenCalledWith("s1", "MANUAL");
    expect(statusText()).toHaveTextContent("Finished");
    expect(timerText()).toHaveTextContent("00:04.000");
  });
});

describe("RunMatch: Did not start, Disqualify and Rematch", () => {
  it("marks a lane Did not start from its menu before the start, and can undo it", async () => {
    await renderRun();
    await click(
      within(lane(2)).getByRole("button", { name: "Lane 2 options" }),
    );
    await click(screen.getByRole("menuitem", { name: "Did not start" }));
    expect(markDns).toHaveBeenCalledWith("he2", true);
    expect(within(lane(2)).getByText("DNS")).toBeInTheDocument();

    await click(
      within(lane(2)).getByRole("button", { name: "Lane 2 options" }),
    );
    await click(screen.getByRole("menuitem", { name: "Undo did not start" }));
    expect(markDns).toHaveBeenLastCalledWith("he2", false);
    expect(within(lane(2)).queryByText("DNS")).toBeNull();
  });

  it("offers Did not start only before the race starts", async () => {
    await renderRun();
    await startRace();
    await click(
      within(lane(1)).getByRole("button", { name: "Lane 1 options" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Did not start" }),
    ).toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Disqualify" }),
    ).toBeInTheDocument();
  });

  it("disqualifies only after a confirmation with a required reason", async () => {
    await renderRun();
    await startRace();
    await click(
      within(lane(1)).getByRole("button", { name: "Lane 1 options" }),
    );
    await click(screen.getByRole("menuitem", { name: "Disqualify" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Disqualify Niko?" }),
    ).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", {
      name: "Disqualify Niko",
    });
    expect(submit).toBeDisabled();
    expect(disqualify).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Reason (required)"), {
      target: { value: "  Left the lane early " },
    });
    expect(submit).toBeEnabled();
    await click(submit);

    expect(disqualify).toHaveBeenCalledWith("e1", "Left the lane early");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(lane(1)).getByText("DQ")).toBeInTheDocument();
  });

  it("fills the reason from a common reason button", async () => {
    await renderRun();
    await startRace();
    await click(
      within(lane(2)).getByRole("button", { name: "Lane 2 options" }),
    );
    await click(screen.getByRole("menuitem", { name: "Disqualify" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "False start" }),
    );
    expect(within(dialog).getByLabelText("Reason (required)")).toHaveValue(
      "False start",
    );
  });

  it("discards the run after a confirmation and returns to the ready state", async () => {
    await renderRun();
    await startRace();
    await advance(4000);
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();

    await click(button("Rematch"));
    expect(
      screen.getByText(/Discard this run and start again\?/),
    ).toBeInTheDocument();
    expect(createSession).toHaveBeenCalledTimes(1);
    await click(button("Discard and rematch"));

    expect(createSession).toHaveBeenLastCalledWith("h2", {
      sessionNumber: 2,
      countdownSeconds: 0,
      cutoffTimeMs: 90000,
      rematchOfSessionId: "s1",
    });
    expect(timerText()).toHaveTextContent("00:00.000");
    expect(statusText()).toHaveTextContent("Ready");
    expect(within(lane(1)).queryByText("Finished")).toBeNull();
    expect(button("Start match")).toBeEnabled();
  });
});

describe("RunMatch: offline queue", () => {
  it("keeps a finish pending while offline, blocks Confirm, and sends it once when back online", async () => {
    await renderRun();
    await startRace();
    await advance(5000);
    setOnLine(false);
    await act(async () => {
      fireEvent.offline(window);
    });
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));

    expect(captureAndAssign).not.toHaveBeenCalled();
    expect(within(lane(1)).getByText("Pending")).toBeInTheDocument();
    expect(within(lane(1)).getByText("00:05.000")).toBeInTheDocument();
    expect(screen.getByText(/1 finish waiting to be sent/)).toBeInTheDocument();

    // Hentikan match: Confirm tetap mati selama antrean tidak kosong.
    await click(button("Stop match"));
    await click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Stop match",
      }),
    );
    expect(statusText()).toHaveTextContent("Finished");
    expect(button("Confirm result")).toBeDisabled();

    setOnLine(true);
    await act(async () => {
      fireEvent.online(window);
    });
    await settle();

    expect(captureAndAssign).toHaveBeenCalledTimes(1);
    expect(captureAndAssign).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: "req-1",
        capturedTimeMs: 5000,
      }),
    );
    expect(screen.queryByText(/waiting to be sent/)).toBeNull();
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();
    expect(button("Confirm result")).toBeEnabled();
  });

  it("keeps the lane pending after a network error and retries with the same request id", async () => {
    await renderRun();
    await startRace();
    await advance(5000);
    vi.mocked(captureAndAssign).mockRejectedValueOnce(
      new ApiError(0, "Network error. Please check your connection."),
    );
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));

    expect(within(lane(1)).getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/1 finish waiting to be sent/)).toBeInTheDocument();
    await click(within(lane(1)).getByRole("button", { name: "Retry" }));

    const ids = vi
      .mocked(captureAndAssign)
      .mock.calls.map((call) => call[0].clientRequestId);
    expect(ids).toEqual(["req-1", "req-1"]);
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();
    expect(screen.queryByText(/waiting to be sent/)).toBeNull();
  });

  it("retries only the assign when a finish was captured but not assigned", async () => {
    await renderRun();
    await startRace();
    await advance(3000);
    const saved: FinishCapture = {
      id: "capX",
      sessionId: "s1",
      finishOrder: 1,
      capturedTimeMs: 3000,
      assignedEntryId: null,
      assignmentStatus: "UNASSIGNED",
      capturedAt: "2026-10-11T08:00:00+00:00",
    };
    vi.mocked(captureAndAssign).mockRejectedValueOnce(
      new AssignFinishError(saved, "e1", new ApiError(0, "Network error.")),
    );
    await click(within(lane(1)).getByRole("button", { name: "Finish" }));

    await click(
      within(lane(1)).getByRole("button", { name: "Not assigned - Retry" }),
    );
    expect(assignFinish).toHaveBeenCalledWith("capX", "e1");
    expect(captureAndAssign).toHaveBeenCalledTimes(1);
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();
  });
});

describe("RunMatch: read-only and load states", () => {
  it("opens a confirmed match read-only with the final ranking and no action buttons", async () => {
    server = sync({
      ...baseMatch(),
      heatStatus: "COMPLETED",
      status: "DONE",
      lanes: [
        {
          ...makeLane(1, "Niko"),
          callStatus: "FINISHED",
          position: 1,
          completedTimeMs: 31250,
        },
        { ...makeLane(2, "Kona"), callStatus: "DNF" },
      ],
    });
    await renderRun();
    expect(statusText()).toHaveTextContent("Result confirmed");
    expect(within(lane(1)).getByText("00:31.250")).toBeInTheDocument();
    expect(within(lane(1)).getByText("Finished")).toBeInTheDocument();
    expect(within(lane(1)).getByText("1st")).toBeInTheDocument();
    expect(within(lane(2)).getByText("DNF")).toBeInTheDocument();
    for (const name of [
      "Start match",
      "Rematch",
      "Confirm result",
      "Finish",
      "Undo",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Lane \d options/ }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to matches" }),
    ).toHaveAttribute("href", "/live/c1/matches");
  });

  it("shows a read-only note when the caller cannot run the match", async () => {
    server = { ...baseMatch(), actions: NO_ACTIONS };
    await renderRun();
    expect(
      screen.getByText(/do not have access to run it/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start match" })).toBeNull();
  });

  it("shows the no-access page on 403", async () => {
    vi.mocked(getMatch).mockRejectedValue(new ApiError(403, "No"));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RunMatch competitionId="c1" matchId="h2" clock={testClock} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });

  it("shows not found without a retry button on 404", async () => {
    vi.mocked(getMatch).mockRejectedValue(
      new ApiError(404, "Match not found."),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RunMatch competitionId="c1" matchId="h2" clock={testClock} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Match not found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
