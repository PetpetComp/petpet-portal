import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { Penalty } from "@/domains/matches/types";
import {
  completeParticipant,
  createAttempt,
  disqualify,
  getQueue,
  markDns,
  newClientRequestId,
  recordTimerResult,
  reopenParticipant,
  retryAttempt,
  revokePenalty,
  skipParticipant,
  startAttempt,
  stopAndRecord,
  timeoutAttempt,
  voidAttempt,
} from "@/domains/timetrial/api";
import {
  attemptFacts,
  bestAttemptOf,
  countedAttempts,
  isActiveStatus,
} from "@/domains/timetrial/attempts";
import { rankBestTimes } from "@/domains/timetrial/rank";
import {
  currentEntryOf,
  isTerminalState,
  participantActions,
  queueStateOf,
} from "@/domains/timetrial/rules";
import type {
  Attempt,
  Queue,
  QueueParticipant,
  RoundEntryStatus,
  TimerResult,
} from "@/domains/timetrial/types";
import { ApiError } from "@/lib/api-client";
import { TimeTrialRun } from "./time-trial-run";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));
vi.mock("@/domains/timetrial/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/timetrial/api")>()),
  getQueue: vi.fn(),
  createAttempt: vi.fn(),
  startAttempt: vi.fn(),
  stopAndRecord: vi.fn(),
  recordTimerResult: vi.fn(),
  timeoutAttempt: vi.fn(),
  retryAttempt: vi.fn(),
  voidAttempt: vi.fn(),
  completeParticipant: vi.fn(),
  reopenParticipant: vi.fn(),
  markDns: vi.fn(),
  skipParticipant: vi.fn(),
  disqualify: vi.fn(),
  revokePenalty: vi.fn(),
  newClientRequestId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Server palsu di memori: antrean Time trial dengan aturan yang SAMA dengan mock asli, karena
// flag `actions`, giliran, peringkat, dan jatah dihitung oleh fungsi domain (rules, attempts, rank).
// ---------------------------------------------------------------------------

const LIMIT = 3;

type FakeEntry = {
  id: string;
  roundEntryId: string;
  pet: string;
  bib: string;
  owner: string;
  status: RoundEntryStatus;
  attempts: Attempt[];
  dq: Penalty | null;
};

let entries: FakeEntry[] = [];
let runner = true;
let drawingLocked = true;
let rules = {
  attemptLimit: LIMIT,
  cutoffMs: 90000,
  countdownSeconds: 0,
  rankingRule: ["TIME_ASC"],
};
let attemptCounter = 0;

/** Satu peserta antrean: e1 Niko, e2 Kona, e3 Milo (bib 101..103). */
function makeEntry(n: number, pet: string): FakeEntry {
  return {
    id: `e${n}`,
    roundEntryId: `re${n}`,
    pet,
    bib: `10${n}`,
    owner: `Owner${n}`,
    status: "WAITING",
    attempts: [],
    dq: null,
  };
}

/** Attempt jadi untuk seed: FINISHED dengan waktu tersimpan, atau status lain tanpa waktu. */
function seedAttempt(
  entryId: string,
  number: number,
  status: Attempt["status"],
  ms?: number,
): Attempt {
  const id = `seed-${entryId}-${number}`;
  return {
    id,
    entryId,
    roundId: "r1",
    number,
    status,
    startedAt: "2026-10-11T08:00:00.000Z",
    stoppedAt: `2026-10-11T08:0${number}:00.000Z`,
    result:
      ms === undefined
        ? null
        : {
            id: `t-${id}`,
            attemptId: id,
            rawDurationMs: ms,
            penaltyMs: 0,
            finalDurationMs: ms,
            finishStatus: "FINISHED",
            recordedAt: "2026-10-11T08:00:40+00:00",
          },
  };
}

/** Menghitung seluruh antrean dari data palsu: giliran, flag actions, waktu terbaik, peringkat. */
function build(): Queue {
  if (!drawingLocked)
    return {
      competitionId: "c1",
      roundId: "r1",
      drawingLocked: false,
      rules,
      currentEntryId: null,
      participants: [],
      summary: {
        total: 0,
        notStarted: 0,
        inProgress: 0,
        done: 0,
        dns: 0,
        dq: 0,
      },
      finished: false,
    };
  const states = entries.map((e) => queueStateOf(e.status, e.dq !== null));
  const active = entries.map((e) =>
    e.attempts.some((a) => isActiveStatus(a.status)),
  );
  const current = currentEntryOf(
    entries.map((e, i) => ({
      entryId: e.id,
      state: states[i],
      hasActiveAttempt: active[i],
    })),
  );
  const bests = entries.map((e) => bestAttemptOf(e.attempts.map(attemptFacts)));
  const ranks = rankBestTimes(
    entries.map((e, i) => ({
      entryId: e.id,
      drawingOrder: i + 1,
      bestTimeMs: bests[i]?.timeMs ?? null,
      bestStoppedAt: bests[i]?.stoppedAt ?? null,
      disqualified: e.dq !== null,
    })),
  );
  const participants: QueueParticipant[] = entries.map((e, i) => {
    const facts = e.attempts.map(attemptFacts);
    return {
      roundEntryId: e.roundEntryId,
      entryId: e.id,
      drawingOrder: i + 1,
      queueNumber: i + 1,
      queuePosition: i + 1,
      status: e.status,
      state: states[i],
      petName: e.pet,
      petMorphName: "Caramel",
      ownerName: e.owner,
      bibNumber: e.bib,
      attempts: [...e.attempts],
      attemptsCounted: countedAttempts(facts),
      bestTimeMs: bests[i]?.timeMs ?? null,
      bestAttemptNumber: bests[i]?.number ?? null,
      bestRank: ranks.get(e.id) ?? null,
      penalties: e.dq ? [e.dq] : [],
      disqualification: e.dq,
      activeAttempt: e.attempts.find((a) => isActiveStatus(a.status)) ?? null,
      actions: participantActions({
        state: states[i],
        disqualified: e.dq !== null,
        attempts: facts,
        attemptLimit: rules.attemptLimit,
        isCurrent: e.id === current,
        otherActive: active.some((flag, j) => j !== i && flag),
        hasOthersWaiting: states.some((s, j) => j !== i && !isTerminalState(s)),
        open: true,
        runner,
        penalizer: runner,
      }),
    };
  });
  const count = (state: string) =>
    participants.filter((p) => p.state === state).length;
  const notStarted = count("NOT_STARTED");
  const inProgress = count("IN_PROGRESS");
  return {
    competitionId: "c1",
    roundId: "r1",
    drawingLocked: true,
    rules,
    currentEntryId: current,
    participants,
    summary: {
      total: participants.length,
      notStarted,
      inProgress,
      done: count("DONE"),
      dns: count("DNS"),
      dq: count("DQ"),
    },
    finished: participants.length > 0 && notStarted + inProgress === 0,
  };
}

/** Mengganti satu attempt (tidak mengubah yang lama). */
function patchAttempt(id: string, patch: Partial<Attempt>): Attempt {
  for (const entry of entries) {
    const index = entry.attempts.findIndex((a) => a.id === id);
    if (index >= 0) {
      entry.attempts[index] = { ...entry.attempts[index], ...patch };
      return entry.attempts[index];
    }
  }
  throw new Error(`attempt not found: ${id}`);
}

function entryOf(id: string): FakeEntry {
  const found = entries.find((e) => e.id === id || e.roundEntryId === id);
  if (!found) throw new Error(`entry not found: ${id}`);
  return found;
}

/** Hasil waktu palsu untuk `stopAndRecord` dan `recordTimerResult`. */
function resultFor(attemptId: string, rawDurationMs: number): TimerResult {
  return {
    id: `t-${attemptId}`,
    attemptId,
    rawDurationMs,
    penaltyMs: 0,
    finalDurationMs: rawDurationMs,
    finishStatus: "FINISHED",
    recordedAt: new Date().toISOString(),
  };
}

/** Memasang implementasi palsu semua fungsi API. Dipanggil di beforeEach. */
function installFakeApi() {
  vi.mocked(getQueue).mockImplementation(async () => build());
  vi.mocked(createAttempt).mockImplementation(async (input) => {
    attemptCounter += 1;
    const attempt: Attempt = {
      id: `a${attemptCounter}`,
      entryId: input.entryId,
      roundId: input.roundId,
      number: input.attemptNumber,
      status: "WAITING",
      startedAt: null,
      stoppedAt: null,
      result: null,
    };
    entryOf(input.entryId).attempts.push(attempt);
    return attempt;
  });
  vi.mocked(startAttempt).mockImplementation(async (id) => {
    const attempt = patchAttempt(id, {
      status: "RUNNING",
      startedAt: new Date().toISOString(),
    });
    const entry = entryOf(attempt.entryId);
    if (entry.status === "WAITING") entry.status = "IN_PROGRESS";
    return attempt;
  });
  vi.mocked(stopAndRecord).mockImplementation(async (input) => {
    const result = resultFor(input.attemptId, input.rawDurationMs);
    patchAttempt(input.attemptId, {
      status: "FINISHED",
      stoppedAt: new Date().toISOString(),
      result,
    });
    return result;
  });
  vi.mocked(recordTimerResult).mockImplementation(async (input) => {
    const result = resultFor(input.attemptId, input.rawDurationMs);
    patchAttempt(input.attemptId, { result });
    return result;
  });
  vi.mocked(timeoutAttempt).mockImplementation(async (id) =>
    patchAttempt(id, {
      status: "TIMEOUT",
      stoppedAt: new Date().toISOString(),
    }),
  );
  vi.mocked(retryAttempt).mockImplementation(async (id, reason) =>
    patchAttempt(id, { status: reason ?? "FALSE_START" }),
  );
  vi.mocked(voidAttempt).mockImplementation(async (id) =>
    patchAttempt(id, { status: "RETRY" }),
  );
  vi.mocked(completeParticipant).mockImplementation(async (id) => {
    entryOf(id).status = "COMPLETED";
    return {} as never;
  });
  vi.mocked(reopenParticipant).mockImplementation(async (id) => {
    entryOf(id).status = "IN_PROGRESS";
    return {} as never;
  });
  vi.mocked(markDns).mockImplementation(async (id, dns) => {
    entryOf(id).status = dns ? "DNS" : "WAITING";
    return {} as never;
  });
  vi.mocked(skipParticipant).mockImplementation(async (_competitionId, id) => {
    const moved = entryOf(id);
    entries = [...entries.filter((e) => e !== moved), moved];
    return build();
  });
  vi.mocked(disqualify).mockImplementation(async (entryId, reason) => {
    const penalty: Penalty = {
      id: "pen1",
      entryId,
      type: "DISQUALIFICATION",
      unit: "DISQUALIFICATION",
      value: 0,
      reason,
      status: "ACTIVE",
      issuedAt: "2026-10-11T08:00:00+00:00",
    };
    entryOf(entryId).dq = penalty;
    return penalty;
  });
  vi.mocked(revokePenalty).mockImplementation(async () => {
    for (const entry of entries) entry.dq = null;
    return {} as never;
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

/** Memasang layar tanpa menunggu apa pun (untuk tes yang menunggu elemen lain). */
function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TimeTrialRun competitionId="c1" clock={testClock} />
    </QueryClientProvider>,
  );
}

/**
 * Render layar, tunggu peserta muncul dengan timer asli (waitFor tidak jalan di fake timers),
 * lalu pindah ke fake timers. rAF diganti setTimeout 16 ms supaya ikut dikendalikan.
 */
async function renderRun() {
  renderScreen();
  await screen.findByRole("region", { name: "Current participant" });
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
}

const timerText = () => screen.getByRole("timer");
const statusText = () => screen.getByTestId("timer-status");
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const card = () => screen.getByRole("region", { name: "Current participant" });
const circle = (label: string) => screen.getByLabelText(label);

/** Aksi "Undo" dari toast pertama yang tampil (toast dimock, jadi tombolnya dipanggil langsung). */
function toastAction(): { label: string; onClick: () => void } {
  const options = vi.mocked(toast).mock.calls[0][1];
  const action = options?.action as {
    label: string;
    onClick: (event: never) => void;
  };
  return {
    label: action.label,
    onClick: () => action.onClick(undefined as never),
  };
}

/** Peserta kedua yang sedang giliran dengan satu false start dan satu attempt 44870 ms (seed 3A). */
function seedMidQueue() {
  entries[0].status = "COMPLETED";
  entries[0].attempts = [seedAttempt("e1", 1, "FINISHED", 38412)];
  entries[1].status = "IN_PROGRESS";
  entries[1].attempts = [
    seedAttempt("e2", 1, "FALSE_START"),
    seedAttempt("e2", 2, "FINISHED", 44870),
  ];
}

beforeEach(() => {
  entries = [makeEntry(1, "Niko"), makeEntry(2, "Kona"), makeEntry(3, "Milo")];
  runner = true;
  drawingLocked = true;
  rules = {
    attemptLimit: LIMIT,
    cutoffMs: 90000,
    countdownSeconds: 0,
    rankingRule: ["TIME_ASC"],
  };
  attemptCounter = 0;
  let requestCounter = 0;
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

describe("TimeTrialRun: the first screen", () => {
  it("shows the progress pill, participant card, attempt circles, cut-off line and the side panels", async () => {
    rules = { ...rules, countdownSeconds: 3 };
    await renderRun();
    expect(screen.getByText("Participant 1 of 3")).toBeInTheDocument();
    expect(within(card()).getByText("Niko")).toBeInTheDocument();
    expect(within(card()).getByText("101")).toBeInTheDocument();
    expect(within(card()).getByText("Owner1 - Caramel")).toBeInTheDocument();
    expect(circle("Attempt 1, next")).toHaveTextContent("1");
    expect(circle("Attempt 2, not used")).toBeInTheDocument();
    expect(circle("Attempt 3, not used")).toBeInTheDocument();
    expect(timerText()).toHaveTextContent("00:00.000");
    expect(statusText()).toHaveTextContent("Ready - countdown 3-2-1 is on");
    expect(screen.getByText(/Cut-off/)).toHaveTextContent("01:30");
    expect(button("Start attempt 1")).toBeEnabled();
    expect(button("Did not start")).toBeEnabled();
    expect(button("Disqualify")).toBeEnabled();
    expect(button("Skip to next")).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
    const best = screen.getByRole("region", { name: "Best times so far" });
    expect(within(best).getByText("No times yet")).toBeInTheDocument();
    const next = screen.getByRole("region", { name: "Up next" });
    expect(within(next).getByText("Kona 102")).toBeInTheDocument();
  });

  it("shows best times, up next and the used attempts from the server state (false start not counted)", async () => {
    seedMidQueue();
    await renderRun();
    expect(screen.getByText("Participant 2 of 3")).toBeInTheDocument();
    expect(within(card()).getByText("Kona")).toBeInTheDocument();
    expect(circle("Attempt 1, counted")).toBeInTheDocument();
    expect(circle("Attempt 2, next")).toBeInTheDocument();
    expect(circle("Attempt 3, not used")).toBeInTheDocument();
    expect(screen.getByText(/attempt 1:/)).toHaveTextContent("00:44.870");
    expect(screen.getByTestId("attempt-note")).toHaveTextContent(
      "New best time 00:44.870 - rank 2",
    );
    const rows = within(
      screen.getByRole("region", { name: "Best times so far" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/1.*Niko.*00:38\.412/);
    expect(rows[1]).toHaveTextContent(/2.*Kona.*00:44\.870/);
    expect(
      within(screen.getByRole("region", { name: "Up next" })).getByText(
        "Milo 103",
      ),
    ).toBeInTheDocument();
    // Nomor fisik naik terus (1 false start, 2 selesai), label layar memakai terhitung + 1.
    await click(button("Start attempt 2"));
    expect(createAttempt).toHaveBeenCalledWith({
      roundId: "r1",
      entryId: "e2",
      attemptNumber: 3,
    });
  });

  it("shows a link to Results when everybody is done, did not start or is disqualified", async () => {
    entries[0].status = "COMPLETED";
    entries[0].attempts = [seedAttempt("e1", 1, "FINISHED", 38412)];
    entries[1].status = "DNS";
    entries[2].status = "COMPLETED";
    entries[2].attempts = [seedAttempt("e3", 1, "FINISHED", 41000)];
    renderScreen();
    expect(
      await screen.findByText("All participants done"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View results" })).toHaveAttribute(
      "href",
      "/live/c1/results",
    );
    expect(screen.queryByRole("button", { name: /Start attempt/ })).toBeNull();
    const best = await screen.findByRole("region", {
      name: "Best times so far",
    });
    expect(within(best).getAllByRole("listitem")).toHaveLength(2);
  });

  it("points to the Running order tab when the order is not locked", async () => {
    drawingLocked = false;
    renderScreen();
    expect(
      await screen.findByText(/The running order is not locked yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Running order" }),
    ).toHaveAttribute("href", "/live/c1/drawing");
  });

  it("shows the no-access page on 403", async () => {
    vi.mocked(getQueue).mockRejectedValue(new ApiError(403, "No"));
    renderScreen();
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });

  it("shows a read-only note and no run buttons when the caller cannot run", async () => {
    runner = false;
    await renderRun();
    expect(
      screen.getByText(/You can view this queue but you do not have access/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start attempt/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip to next" })).toBeNull();
  });
});

describe("TimeTrialRun: an attempt", () => {
  it("counts down 3-2-1, creates and starts the attempt, then runs the timer", async () => {
    rules = { ...rules, countdownSeconds: 3 };
    await renderRun();
    await click(button("Start attempt 1"));
    expect(createAttempt).toHaveBeenCalledWith({
      roundId: "r1",
      entryId: "e1",
      attemptNumber: 1,
    });
    expect(statusText()).toHaveTextContent("Get ready");
    expect(timerText()).toHaveTextContent("3");
    await advance(1100);
    expect(timerText()).toHaveTextContent("2");
    expect(startAttempt).not.toHaveBeenCalled();
    await advance(1900);
    await settle();
    expect(startAttempt).toHaveBeenCalledWith("a1");
    expect(statusText()).toHaveTextContent("Running");
    expect(timerText()).toHaveTextContent(/^00:00\.\d{3}$/);
    expect(button("Stop")).toBeEnabled();
    expect(button("Retry (false start)")).toBeEnabled();
    await advance(1100);
    expect(timerText()).toHaveTextContent(/^00:01\.0\d{2}$/);
  });

  it("stops with one tap, records the exact time seen at the tap and shows the result", async () => {
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    expect(statusText()).toHaveTextContent("Running");
    await advance(7000);
    await click(button("Stop"));
    expect(stopAndRecord).toHaveBeenCalledWith({
      attemptId: "a1",
      rawDurationMs: 7000,
      clientRequestId: "req-1",
    });
    expect(timerText()).toHaveTextContent("00:07.000");
    expect(toast).toHaveBeenCalledWith(
      "Niko - attempt 1: 00:07.000",
      expect.objectContaining({ duration: 5000 }),
    );
    // Hasil tersimpan: lingkaran terisi, baris attempt, catatan peringkat, tombol berikutnya.
    expect(circle("Attempt 1, counted")).toBeInTheDocument();
    expect(circle("Attempt 2, next")).toBeInTheDocument();
    expect(screen.getByText(/attempt 1:/)).toHaveTextContent("00:07.000");
    expect(screen.getByTestId("attempt-note")).toHaveTextContent(
      "New best time 00:07.000 - rank 1",
    );
    expect(statusText()).toHaveTextContent("Attempt 1 recorded");
    expect(button("Start attempt 2")).toBeEnabled();
    expect(button("Next participant")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    const best = screen.getByRole("region", { name: "Best times so far" });
    expect(within(best).getByText("Niko")).toBeInTheDocument();
    expect(within(best).getByText("00:07.000")).toBeInTheDocument();
  });

  it("starts attempt 2 after attempt 1 and uses the whole quota before Next participant", async () => {
    await renderRun();
    for (const [label, ms] of [
      ["Start attempt 1", 3000],
      ["Start attempt 2", 4000],
      ["Start attempt 3", 5000],
    ] as const) {
      await click(button(label));
      await settle();
      await advance(ms);
      await click(button("Stop"));
    }
    expect(createAttempt).toHaveBeenLastCalledWith({
      roundId: "r1",
      entryId: "e1",
      attemptNumber: 3,
    });
    expect(circle("Attempt 3, counted")).toBeInTheDocument();
    // Jatah habis: hanya Next participant (tombol utama), tanpa Start attempt.
    expect(screen.queryByRole("button", { name: /Start attempt/ })).toBeNull();
    await click(button("Next participant"));
    expect(completeParticipant).toHaveBeenCalledWith("re1");
    expect(screen.getByText("Participant 2 of 3")).toBeInTheDocument();
    expect(within(card()).getByText("Kona")).toBeInTheDocument();
  });

  it("does not consume an attempt on Retry (false start)", async () => {
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    await advance(2000);
    await click(button("Retry (false start)"));
    expect(retryAttempt).toHaveBeenCalledWith("a1", undefined);
    expect(timerText()).toHaveTextContent("00:00.000");
    expect(circle("Attempt 1, next")).toBeInTheDocument();
    expect(button("Start attempt 1")).toBeEnabled();
    // Nomor fisik naik (2) walau labelnya tetap "attempt 1".
    await click(button("Start attempt 1"));
    expect(createAttempt).toHaveBeenLastCalledWith({
      roundId: "r1",
      entryId: "e1",
      attemptNumber: 2,
    });
  });

  it("cancels the countdown with Retry without starting the attempt", async () => {
    rules = { ...rules, countdownSeconds: 3 };
    await renderRun();
    await click(button("Start attempt 1"));
    await advance(500);
    await click(button("Retry (false start)"));
    await advance(5000);
    expect(retryAttempt).toHaveBeenCalledWith("a1", undefined);
    expect(startAttempt).not.toHaveBeenCalled();
    expect(timerText()).toHaveTextContent("00:00.000");
  });

  it("undoes the last result from the 5 second toast action", async () => {
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    await advance(6000);
    await click(button("Stop"));
    expect(circle("Attempt 1, counted")).toBeInTheDocument();
    expect(toastAction().label).toBe("Undo");
    await act(async () => {
      toastAction().onClick();
    });
    await settle();
    expect(voidAttempt).toHaveBeenCalledWith("a1");
    expect(circle("Attempt 1, next")).toBeInTheDocument();
    expect(button("Start attempt 1")).toBeEnabled();
    expect(timerText()).toHaveTextContent("00:00.000");
  });

  it("undoes the last result with the Undo button", async () => {
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    await advance(6000);
    await click(button("Stop"));
    await click(button("Undo last result"));
    expect(voidAttempt).toHaveBeenCalledWith("a1");
    expect(circle("Attempt 1, next")).toBeInTheDocument();
  });

  it("stops at the cut-off with status TIMEOUT, keeps the time frozen and counts the attempt", async () => {
    rules = { ...rules, cutoffMs: 5000 };
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    await advance(5100);
    await settle();
    expect(timeoutAttempt).toHaveBeenCalledWith("a1");
    expect(stopAndRecord).not.toHaveBeenCalled();
    expect(timerText()).toHaveTextContent("00:05.000");
    expect(circle("Attempt 1, counted")).toBeInTheDocument();
    expect(screen.getByText(/attempt 1:/)).toHaveTextContent("Timeout");
    expect(statusText()).toHaveTextContent(
      "Cut-off reached - attempt 1 counted",
    );
    expect(button("Start attempt 2")).toBeEnabled();
  });

  it("resumes a running attempt after a reload from the server start time", async () => {
    entries[0].status = "IN_PROGRESS";
    entries[0].attempts = [
      {
        ...seedAttempt("e1", 1, "RUNNING"),
        startedAt: new Date(Date.now() - 5000).toISOString(),
        stoppedAt: null,
      },
    ];
    await renderRun();
    expect(statusText()).toHaveTextContent("Running");
    expect(timerText()).toHaveTextContent(/^00:0[5-6]\.\d{3}$/);
    expect(button("Stop")).toBeEnabled();
    await advance(2000);
    expect(timerText()).toHaveTextContent(/^00:0[7-8]\.\d{3}$/);
  });
});

describe("TimeTrialRun: participant actions", () => {
  it("marks Did not start only after a confirmation and moves to the next participant", async () => {
    await renderRun();
    fireEvent.click(button("Did not start"));
    const dialog = screen.getByRole("dialog");
    expect(markDns).not.toHaveBeenCalled();
    await click(within(dialog).getByRole("button", { name: "Did not start" }));
    expect(markDns).toHaveBeenCalledWith("re1", true);
    expect(screen.getByText("Participant 2 of 3")).toBeInTheDocument();
    expect(within(card()).getByText("Kona")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      "Niko did not start",
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it("disqualifies only with a required reason and moves to the next participant", async () => {
    await renderRun();
    fireEvent.click(button("Disqualify"));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", {
      name: "Disqualify Niko",
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason (required)"), {
      target: { value: "Left the lane" },
    });
    expect(confirm).toBeEnabled();
    await click(confirm);
    expect(disqualify).toHaveBeenCalledWith("e1", "Left the lane");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Participant 2 of 3")).toBeInTheDocument();
    expect(within(card()).getByText("Kona")).toBeInTheDocument();
  });

  it("skips the participant to the end of the queue", async () => {
    await renderRun();
    await click(button("Skip to next"));
    expect(skipParticipant).toHaveBeenCalledWith("c1", "e1");
    expect(within(card()).getByText("Kona")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Up next" })).getByText(
        "Milo 103",
      ),
    ).toBeInTheDocument();
  });

  it("offers Did not start and Skip only before the first attempt is counted", async () => {
    seedMidQueue();
    await renderRun();
    expect(button("Did not start")).toBeDisabled();
    expect(button("Skip to next")).toBeDisabled();
    expect(button("Disqualify")).toBeEnabled();
  });

  it("goes to the next participant and offers Undo (reopen) in the toast", async () => {
    seedMidQueue();
    await renderRun();
    await click(button("Next participant"));
    expect(completeParticipant).toHaveBeenCalledWith("re2");
    expect(screen.getByText("Participant 3 of 3")).toBeInTheDocument();
    expect(within(card()).getByText("Milo")).toBeInTheDocument();
    await act(async () => {
      toastAction().onClick();
    });
    await settle();
    expect(reopenParticipant).toHaveBeenCalledWith("re2");
  });
});

describe("TimeTrialRun: offline queue", () => {
  it("keeps the result pending while offline, blocks the next steps and sends it once when back online", async () => {
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    await advance(4000);
    setOnLine(false);
    await act(async () => {
      fireEvent.offline(window);
    });
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    await click(button("Stop"));
    expect(stopAndRecord).not.toHaveBeenCalled();
    expect(timerText()).toHaveTextContent("00:04.000");
    expect(statusText()).toHaveTextContent(
      "Pending - waiting for a connection",
    );
    expect(screen.getByText("1 result waiting to be sent")).toBeInTheDocument();
    // Selama antrean tidak kosong tidak ada Start attempt / Next participant, dan aksi peserta mati.
    expect(screen.queryByRole("button", { name: /Start attempt/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Next participant" }),
    ).toBeNull();
    expect(button("Disqualify")).toBeDisabled();

    setOnLine(true);
    await act(async () => {
      fireEvent.online(window);
    });
    await settle();
    expect(stopAndRecord).toHaveBeenCalledTimes(1);
    expect(stopAndRecord).toHaveBeenCalledWith({
      attemptId: "a1",
      rawDurationMs: 4000,
      clientRequestId: "req-1",
    });
    expect(screen.queryByText(/waiting to be sent/)).toBeNull();
    expect(circle("Attempt 1, counted")).toBeInTheDocument();
    expect(button("Start attempt 2")).toBeEnabled();
  });

  it("keeps the result pending after a network error and retries with the same request id", async () => {
    vi.mocked(stopAndRecord).mockRejectedValueOnce(
      new ApiError(0, "Network down"),
    );
    await renderRun();
    await click(button("Start attempt 1"));
    await settle();
    await advance(4000);
    await click(button("Stop"));
    expect(screen.getByText("1 result waiting to be sent")).toBeInTheDocument();
    expect(statusText()).toHaveTextContent(
      "Pending - waiting for a connection",
    );
    await click(button("Retry now"));
    expect(stopAndRecord).toHaveBeenCalledTimes(2);
    expect(vi.mocked(stopAndRecord).mock.calls[1][0]).toEqual({
      attemptId: "a1",
      rawDurationMs: 4000,
      clientRequestId: "req-1",
    });
    expect(screen.queryByText(/waiting to be sent/)).toBeNull();
    expect(circle("Attempt 1, counted")).toBeInTheDocument();
  });
});
