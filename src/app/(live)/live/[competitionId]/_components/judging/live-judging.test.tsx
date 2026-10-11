import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  ensureScorecard,
  getJudging,
  LockError,
  lockScorecard,
  saveJudgeNote,
  saveScores,
  submitAndLock,
} from "@/domains/judging/api";
import type {
  Judging,
  Scorecard,
  ScorecardStatus,
  ScoreMap,
} from "@/domains/judging/types";
import { ApiError } from "@/lib/api-client";
import { LiveJudging } from "./live-judging";
import {
  FULL_SCORES,
  judgingFixture,
  participantFixture,
} from "./test-fixtures";

const state = vi.hoisted(() => ({ typeId: "beauty" }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    getCompetition: vi.fn(async () =>
      competitionFixture({ id: "c1", typeId: state.typeId }),
    ),
    listCompetitionTypes: vi.fn().mockResolvedValue([
      { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      {
        id: "beauty",
        code: "BEAUTY",
        name: "Beauty",
        resultMode: "JUDGED_SCORE",
      },
    ]),
  };
});
vi.mock("@/domains/judging/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/judging/api")>()),
  getJudging: vi.fn(),
  ensureScorecard: vi.fn(),
  saveScores: vi.fn(),
  saveJudgeNote: vi.fn(),
  submitAndLock: vi.fn(),
  lockScorecard: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Server palsu di memori: scorecard disimpan per id supaya respons PUT/PATCH/lock realistis
// (cache layar diperbarui dari respons itu, sama seperti dengan server sungguhan).
// ---------------------------------------------------------------------------

type Card = {
  entryId: string;
  status: ScorecardStatus;
  scores: ScoreMap;
  judgeNote: string;
};

let cards: Map<string, Card>;

/** Scorecard (bentuk layar) dari kartu palsu. */
function scorecardOf(id: string): Scorecard {
  const card = cards.get(id)!;
  return {
    id,
    roundId: "round-c1-1",
    entryId: card.entryId,
    staffAssignmentId: "sa-1",
    status: card.status,
    judgeNote: card.judgeNote,
    submittedAt: null,
    lockedAt: card.status === "LOCKED" ? "2026-10-11T08:00:00Z" : null,
    scores: card.scores,
  };
}

/** Mengisi server palsu dari data `Judging` dan memasang semua mock api. */
function seed(judging: Judging) {
  cards = new Map();
  for (const p of judging.participants) {
    if (!p.scorecardId) continue;
    cards.set(p.scorecardId, {
      entryId: p.entryId,
      status: p.status === "NOT_SCORED" ? "DRAFT" : p.status,
      scores: p.scores,
      judgeNote: p.judgeNote,
    });
  }
  vi.mocked(getJudging).mockReset().mockResolvedValue(judging);
  vi.mocked(ensureScorecard)
    .mockReset()
    .mockImplementation(async (input) => {
      const id = `sc-new-${input.entryId}`;
      cards.set(id, {
        entryId: input.entryId,
        status: "DRAFT",
        scores: {},
        judgeNote: "",
      });
      return id;
    });
  vi.mocked(saveScores)
    .mockReset()
    .mockImplementation(async (id, changes) => {
      const card = cards.get(id)!;
      const scores: ScoreMap = { ...card.scores };
      for (const c of changes)
        scores[c.criterionId] = {
          score: c.score,
          note: c.note ?? scores[c.criterionId]?.note ?? "",
        };
      card.scores = scores;
      return scorecardOf(id);
    });
  vi.mocked(saveJudgeNote)
    .mockReset()
    .mockImplementation(async (id, note) => {
      cards.get(id)!.judgeNote = note;
      return scorecardOf(id);
    });
  vi.mocked(submitAndLock)
    .mockReset()
    .mockImplementation(async (id) => {
      cards.get(id)!.status = "LOCKED";
      return scorecardOf(id);
    });
  vi.mocked(lockScorecard)
    .mockReset()
    .mockImplementation(async (id) => {
      cards.get(id)!.status = "LOCKED";
      return scorecardOf(id);
    });
}

/** Antrean di mana Pet2 sudah punya semua skor + catatan (siap di-submit, total 77). */
function readyToSubmit(): Judging {
  const base = judgingFixture();
  return {
    ...base,
    participants: base.participants.map((p) =>
      p.entryId === "e2" ? participantFixture(2, "DRAFT", FULL_SCORES) : p,
    ),
  };
}

/** Mengatur navigator.onLine untuk satu tes. */
function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LiveJudging competitionId="c1" />
    </QueryClientProvider>,
  );
}

/** Menunggu layar Judging siap dengan peserta tertentu terbuka. */
async function openPet(name: RegExp) {
  return screen.findByRole("heading", { name });
}

const queue = () =>
  within(screen.getByRole("navigation", { name: "Judging queue" }));
const slider = (name: string) => screen.getByRole("slider", { name });
const WAIT = { timeout: 2000 };

beforeEach(() => {
  state.typeId = "beauty";
  setOnLine(true);
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  seed(judgingFixture());
});
afterEach(() => setOnLine(true));

describe("LiveJudging: queue", () => {
  it("lists the queue with statuses, opens the first unscored one and switches freely", async () => {
    renderScreen();
    await openPet(/Pet2/);
    expect(screen.getByText(/Mock data/)).toBeInTheDocument();
    expect(queue().getByRole("button", { name: /Pet1/ })).toHaveTextContent(
      "Scored",
    );
    expect(queue().getByRole("button", { name: /Pet2/ })).toHaveTextContent(
      "Now",
    );
    expect(queue().getByRole("button", { name: /Pet3/ })).toHaveTextContent(
      "Waiting",
    );
    // Owner dan morph tampil di bawah nama.
    expect(screen.getByText("Owner2 - Classic Grey")).toBeInTheDocument();

    fireEvent.click(queue().getByRole("button", { name: /Pet3/ }));
    await openPet(/Pet3/);
    expect(queue().getByRole("button", { name: /Pet2/ })).toHaveTextContent(
      "Draft",
    );
    expect(screen.getAllByText("Not scored yet")).toHaveLength(3);
    expect(screen.getByTestId("total")).toHaveTextContent("--");
  });
});

describe("LiveJudging: autosave", () => {
  it("creates the scorecard lazily once and saves only the changed criterion", async () => {
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.click(queue().getByRole("button", { name: /Pet3/ }));
    await openPet(/Pet3/);

    fireEvent.change(slider("Appearance"), { target: { value: "8" } });
    // Total langsung: 80 persen * bobot 40 / 100 = 32.
    expect(screen.getByTestId("total")).toHaveTextContent("32");
    expect(saveScores).not.toHaveBeenCalled();

    await waitFor(() => expect(saveScores).toHaveBeenCalledTimes(1), WAIT);
    expect(ensureScorecard).toHaveBeenCalledTimes(1);
    expect(ensureScorecard).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: "round-c1-1",
        entryId: "e3",
        scorecardId: null,
      }),
    );
    expect(saveScores).toHaveBeenCalledWith("sc-new-e3", [
      { criterionId: "appearance", score: 8 },
    ]);

    fireEvent.change(slider("Behavior"), { target: { value: "6" } });
    await waitFor(() => expect(saveScores).toHaveBeenCalledTimes(2), WAIT);
    expect(ensureScorecard).toHaveBeenCalledTimes(1);
    expect(saveScores).toHaveBeenLastCalledWith("sc-new-e3", [
      { criterionId: "behavior", score: 6 },
    ]);
  });

  it("coalesces quick changes into one debounced save and updates the total", async () => {
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.change(slider("Behavior"), { target: { value: "6" } });
    fireEvent.change(slider("Presentation"), { target: { value: "9" } });
    // Appearance 5 (dari server), Behavior 6, Presentation 9 -> (2000 + 1800 + 2700) / 100.
    expect(screen.getByTestId("total")).toHaveTextContent("65");
    expect(saveScores).not.toHaveBeenCalled();

    await waitFor(() => expect(saveScores).toHaveBeenCalledTimes(1), WAIT);
    expect(saveScores).toHaveBeenCalledWith("sc-2", [
      { criterionId: "behavior", score: 6 },
      { criterionId: "presentation", score: 9 },
    ]);
    expect(ensureScorecard).not.toHaveBeenCalled();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("flushes the pending save immediately when switching participant", async () => {
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.change(slider("Appearance"), { target: { value: "7" } });
    fireEvent.click(queue().getByRole("button", { name: /Pet3/ }));
    // Jauh lebih cepat daripada jeda debounce 600 ms.
    await waitFor(
      () =>
        expect(saveScores).toHaveBeenCalledWith("sc-2", [
          { criterionId: "appearance", score: 7 },
        ]),
      { timeout: 400 },
    );
  });

  it("keeps edits while offline and retries when the browser comes back online", async () => {
    renderScreen();
    await openPet(/Pet2/);
    setOnLine(false);
    fireEvent.change(slider("Appearance"), { target: { value: "7" } });

    expect(
      await screen.findByText("Offline - will retry", {}, WAIT),
    ).toBeInTheDocument();
    expect(saveScores).not.toHaveBeenCalled();
    expect(screen.getByTestId("value-appearance")).toHaveTextContent("7");

    setOnLine(true);
    fireEvent.online(window);
    await waitFor(
      () =>
        expect(saveScores).toHaveBeenCalledWith("sc-2", [
          { criterionId: "appearance", score: 7 },
        ]),
      WAIT,
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("keeps edits and shows Retry when the save fails", async () => {
    vi.mocked(saveScores).mockRejectedValueOnce(new ApiError(0, "Network"));
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.change(slider("Appearance"), { target: { value: "7" } });
    expect(
      await screen.findByText("Offline - will retry", {}, WAIT),
    ).toBeInTheDocument();
    expect(screen.getByTestId("value-appearance")).toHaveTextContent("7");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(saveScores).toHaveBeenCalledTimes(2), WAIT);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});

describe("LiveJudging: submit and lock", () => {
  it("blocks submit while a required note is empty and focuses it", async () => {
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.change(slider("Behavior"), { target: { value: "6" } });
    fireEvent.change(slider("Presentation"), { target: { value: "9" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit & lock score" }),
    );

    expect(
      screen.getByText("A note is required for Presentation."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(submitAndLock).not.toHaveBeenCalled();
    const note = screen.getByRole("textbox", { name: "Note (required)" });
    expect(note).toHaveFocus();

    fireEvent.change(note, { target: { value: "Calm and proud" } });
    expect(
      screen.queryByText("A note is required for Presentation."),
    ).toBeNull();
  });

  it("asks for confirmation, locks, and opens the next unscored participant", async () => {
    seed(readyToSubmit());
    renderScreen();
    await openPet(/Pet2/);
    expect(screen.getByTestId("total")).toHaveTextContent("77");

    fireEvent.click(
      screen.getByRole("button", { name: "Submit & lock score" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Total 77 \/100 for Pet2/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/You cannot change this score after locking/),
    ).toBeInTheDocument();
    expect(submitAndLock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Lock score" }));
    await openPet(/Pet3/);
    expect(submitAndLock).toHaveBeenCalledWith("sc-2", "");
    expect(toast.success).toHaveBeenCalledWith("Score locked");
    expect(queue().getByRole("button", { name: /Pet2/ })).toHaveTextContent(
      "Scored",
    );
  });

  it("shows the all-scored state after the last participant is locked", async () => {
    const base = readyToSubmit();
    seed({
      ...base,
      participants: base.participants.map((p) =>
        p.entryId === "e3" || p.entryId === "e4"
          ? participantFixture(
              Number(p.entryId.slice(1)),
              "LOCKED",
              FULL_SCORES,
            )
          : p,
      ),
    });
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.click(
      screen.getByRole("button", { name: "Submit & lock score" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Lock score" }));
    expect(
      await screen.findByText("All participants scored"),
    ).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("offers Retry lock when only the lock failed", async () => {
    seed(readyToSubmit());
    vi.mocked(submitAndLock).mockRejectedValueOnce(
      new LockError(
        {
          id: "sc-2",
          roundId: "round-c1-1",
          entryId: "e2",
          staffAssignmentId: "sa-1",
          status: "SUBMITTED",
          judgeNote: "",
          submittedAt: "2026-10-11T08:00:00Z",
          lockedAt: null,
          scores: FULL_SCORES,
        },
        new Error("network"),
      ),
    );
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.click(
      screen.getByRole("button", { name: "Submit & lock score" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Lock score" }));

    expect(
      await screen.findByText("Submitted, not locked yet"),
    ).toBeInTheDocument();
    screen.getAllByRole("slider").forEach((s) => expect(s).toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: "Retry lock" }));
    await openPet(/Pet3/);
    expect(lockScorecard).toHaveBeenCalledWith("sc-2");
    expect(toast.success).toHaveBeenCalledWith("Score locked");
  });
});

describe("LiveJudging: read-only modes", () => {
  it("shows a locked scorecard read-only without a submit button", async () => {
    renderScreen();
    await openPet(/Pet2/);
    fireEvent.click(queue().getByRole("button", { name: /Pet1/ }));
    await openPet(/Pet1/);

    expect(screen.getByText("Locked")).toBeInTheDocument();
    screen.getAllByRole("slider").forEach((s) => expect(s).toBeDisabled());
    expect(screen.getByText("Great stage presence")).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("77");
    expect(
      screen.queryByRole("button", { name: "Submit & lock score" }),
    ).toBeNull();
  });

  it("is read-only for someone who cannot score but still shows the queue", async () => {
    seed(judgingFixture({ canScore: false, judge: null }));
    renderScreen();
    await openPet(/Pet2/);
    expect(
      screen.getByText(/Only assigned judges can score/),
    ).toBeInTheDocument();
    screen.getAllByRole("slider").forEach((s) => expect(s).toBeDisabled());
    expect(
      screen.queryByRole("button", { name: "Submit & lock score" }),
    ).toBeNull();
    expect(queue().getAllByRole("button")).toHaveLength(4);
  });
});

describe("LiveJudging: loading and errors", () => {
  it("shows No access when the API answers 403", async () => {
    vi.mocked(getJudging).mockRejectedValue(new ApiError(403, "No"));
    renderScreen();
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });

  it("offers Try again for other errors", async () => {
    vi.mocked(getJudging).mockRejectedValue(new Error("Boom"));
    renderScreen();
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("explains that other competition types do not use judging", async () => {
    state.typeId = "race";
    renderScreen();
    expect(
      await screen.findByRole("link", { name: "Go to Drawing" }),
    ).toHaveAttribute("href", "/live/c1/drawing");
    expect(getJudging).not.toHaveBeenCalled();
  });
});
