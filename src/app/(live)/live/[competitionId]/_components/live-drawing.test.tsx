import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { getDrawing, lockDrawing, swapDrawing } from "@/domains/drawing/api";
import { buildDrawing } from "@/domains/drawing/draw";
import type {
  CompetitionDrawing,
  DrawingMatch,
  DrawingParticipant,
} from "@/domains/drawing/types";
import { LiveDrawing } from "./live-drawing";

const state = vi.hoisted(() => ({ typeId: "race", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    getCompetition: vi.fn(async () =>
      competitionFixture({ id: "c1", typeId: state.typeId }),
    ),
    listCompetitionTypes: vi.fn().mockResolvedValue([
      { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      { id: "tt", code: "TIME_TRIAL", name: "Time trial", resultMode: "TIME" },
    ]),
  };
});
vi.mock("@/domains/drawing/api", () => ({
  getDrawing: vi.fn(),
  lockDrawing: vi.fn(),
  swapDrawing: vi.fn(),
}));
// Hanya buildDrawing yang diganti (supaya hasil undian bisa ditentukan); sisanya asli.
vi.mock("@/domains/drawing/draw", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/drawing/draw")>()),
  buildDrawing: vi.fn(),
}));

const FIRST_DRAW = [
  ["e1", "e2", "e3"],
  ["e4", "e5"],
];
const SECOND_DRAW = [
  ["e5", "e4", "e3"],
  ["e2", "e1"],
];

/** Peserta e1..en: Pet1/Owner1/001, dst. */
function participants(n: number): DrawingParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    entryId: `e${i + 1}`,
    petName: `Pet${i + 1}`,
    ownerName: `Owner${i + 1}`,
    bibNumber: `00${i + 1}`,
  }));
}

/** Drawing dari API (bentuk layar). `over` menimpa field yang dibutuhkan tes. */
function drawing(over: Partial<CompetitionDrawing> = {}): CompetitionDrawing {
  return {
    competitionId: "c1",
    locked: false,
    lanes: 3,
    lockedAt: null,
    lockedByName: null,
    participants: participants(5),
    matches: [],
    lockBlockedReason: null,
    actions: { lock: true, swap: false },
    ...over,
  };
}

/** Match terkunci dari daftar entry id (semua peserta dikenal dari `all`). */
function lockedMatches(
  ids: string[][],
  all: DrawingParticipant[],
  statuses: DrawingMatch["status"][] = [],
): DrawingMatch[] {
  return ids.map((row, index) => ({
    id: `h${index + 1}`,
    number: index + 1,
    status: statuses[index] ?? "SCHEDULED",
    lanes: row.map((entryId, laneIndex) => ({
      ...all.find((p) => p.entryId === entryId)!,
      laneNumber: laneIndex + 1,
    })),
  }));
}

function lockedDrawing(over: Partial<CompetitionDrawing> = {}) {
  const all = participants(6);
  return drawing({
    locked: true,
    lockedAt: "2026-10-11T07:00:00+00:00",
    lockedByName: "Organizer Demo",
    participants: all,
    matches: lockedMatches([["e1", "e2", "e3"], ["e4", "e5"], ["e6"]], all, [
      "SCHEDULED",
      "SCHEDULED",
      "IN_PROGRESS",
    ]),
    lockBlockedReason: "ALREADY_LOCKED",
    actions: { lock: false, swap: true },
    ...over,
  });
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LiveDrawing competitionId="c1" />
    </QueryClientProvider>,
  );
}

const match = (n: number) => screen.getByRole("region", { name: `Match ${n}` });

beforeEach(() => {
  state.typeId = "race";
  state.push.mockReset();
  vi.mocked(getDrawing).mockReset().mockResolvedValue(drawing());
  vi.mocked(lockDrawing).mockReset();
  vi.mocked(swapDrawing).mockReset();
  vi.mocked(buildDrawing).mockReset().mockReturnValue(FIRST_DRAW);
});

describe("LiveDrawing: not drawn yet (draft)", () => {
  it("shows a draft built from the eligible participants with the stats", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    expect(buildDrawing).toHaveBeenCalledWith(
      ["e1", "e2", "e3", "e4", "e5"],
      3,
    );
    expect(
      screen.getByText("checked in").previousElementSibling,
    ).toHaveTextContent("5");
    expect(screen.getByText("lanes").previousElementSibling).toHaveTextContent(
      "3",
    );
    expect(
      screen.getByText("matches").previousElementSibling,
    ).toHaveTextContent("2");
    expect(match(1)).toHaveTextContent(/Pet1.*Pet2.*Pet3/);
    expect(match(2)).toHaveTextContent(/Pet4.*Pet5/);
    // Draf hanya hasil lokal: belum ada yang disimpan.
    expect(lockDrawing).not.toHaveBeenCalled();
  });

  it("re-draws on Shuffle again", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    vi.mocked(buildDrawing).mockReturnValueOnce(SECOND_DRAW);
    fireEvent.click(screen.getByRole("button", { name: "Shuffle again" }));
    await waitFor(() => expect(match(1)).toHaveTextContent(/Pet5.*Pet4.*Pet3/));
    expect(match(2)).toHaveTextContent(/Pet2.*Pet1/);
    expect(lockDrawing).not.toHaveBeenCalled();
  });

  it("disables Lock and shows the API reason when actions.lock is false", async () => {
    vi.mocked(getDrawing).mockResolvedValue(
      drawing({
        actions: { lock: false, swap: false },
        lockBlockedReason: "REGISTRATION_OPEN",
      }),
    );
    renderScreen();
    const lock = await screen.findByRole("button", {
      name: /Lock drawing & go to matches/,
    });
    expect(lock).toBeDisabled();
    expect(
      screen.getByText("Close registration before drawing."),
    ).toBeInTheDocument();
  });

  it("locks the draft order through the API and goes to Matches", async () => {
    vi.mocked(lockDrawing).mockResolvedValue(lockedDrawing());
    renderScreen();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Lock drawing & go to matches/,
      }),
    );
    await waitFor(() =>
      expect(state.push).toHaveBeenCalledWith("/live/c1/matches"),
    );
    expect(lockDrawing).toHaveBeenCalledWith("c1", FIRST_DRAW);
  });

  it("shows a Lock error inline, stays on the screen and can retry", async () => {
    vi.mocked(lockDrawing)
      .mockRejectedValueOnce(new Error("Registration is still open."))
      .mockResolvedValueOnce(lockedDrawing());
    renderScreen();
    const lock = await screen.findByRole("button", {
      name: /Lock drawing & go to matches/,
    });
    fireEvent.click(lock);
    expect(
      await screen.findByText(/Registration is still open\./),
    ).toBeInTheDocument();
    expect(state.push).not.toHaveBeenCalled();
    expect(lock).toBeEnabled();
    fireEvent.click(lock);
    await waitFor(() => expect(state.push).toHaveBeenCalledTimes(1));
  });

  it("shows an empty state when nobody is eligible", async () => {
    vi.mocked(buildDrawing).mockReturnValue([]);
    vi.mocked(getDrawing).mockResolvedValue(
      drawing({
        participants: [],
        actions: { lock: false, swap: false },
        lockBlockedReason: "NO_PARTICIPANTS",
      }),
    );
    renderScreen();
    expect(
      await screen.findByText(
        /No participant is checked in and paid yet\. Participants/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Match/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Lock drawing & go to matches/ }),
    ).toBeDisabled();
  });
});

describe("LiveDrawing: locked", () => {
  it("shows the locked drawing read-only when swapping is not allowed", async () => {
    vi.mocked(getDrawing).mockResolvedValue(
      lockedDrawing({ actions: { lock: false, swap: false } }),
    );
    renderScreen();
    expect(await screen.findByText("Locked")).toBeInTheDocument();
    expect(screen.getByText(/by Organizer Demo/)).toBeInTheDocument();
    expect(match(1)).toHaveTextContent(/Pet1.*Pet2.*Pet3/);
    expect(screen.queryByRole("button", { name: /Lane/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Lock drawing/ })).toBeNull();
    expect(buildDrawing).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Go to matches" })).toHaveAttribute(
      "href",
      "/live/c1/matches",
    );
  });

  it("swaps two participants in two steps with a confirmation", async () => {
    vi.mocked(getDrawing).mockResolvedValue(lockedDrawing());
    vi.mocked(swapDrawing).mockResolvedValue(lockedDrawing());
    renderScreen();
    const first = await screen.findByRole("button", { name: "Lane 1, Pet1" });
    // Match yang sudah berjalan tidak bisa dipilih.
    expect(screen.queryByRole("button", { name: /Pet6/ })).toBeNull();
    expect(within(match(3)).getByText("In progress")).toBeInTheDocument();

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/Pick the participant to swap with/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm swap" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Lane 2, Pet5" }));
    expect(
      screen.getByText("Pet1 (Match 1, lane 1)", { exact: false }),
    ).toBeInTheDocument();
    expect(swapDrawing).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    await waitFor(() =>
      expect(swapDrawing).toHaveBeenCalledWith("c1", "e1", "e5"),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Participants swapped"),
    );
    // Setelah sukses pilihan dibersihkan.
    expect(
      screen.getByRole("button", { name: "Lane 1, Pet1" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("can cancel a selection without calling the API", async () => {
    vi.mocked(getDrawing).mockResolvedValue(lockedDrawing());
    renderScreen();
    fireEvent.click(
      await screen.findByRole("button", { name: "Lane 1, Pet1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Lane 1, Pet1" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(swapDrawing).not.toHaveBeenCalled();
  });

  it("shows a swap error inline and keeps the selection for a retry", async () => {
    vi.mocked(getDrawing).mockResolvedValue(lockedDrawing());
    vi.mocked(swapDrawing).mockRejectedValueOnce(
      new Error("Match already started."),
    );
    renderScreen();
    fireEvent.click(
      await screen.findByRole("button", { name: "Lane 1, Pet1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lane 2, Pet5" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    expect(
      await screen.findByText(/Match already started\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm swap" })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("LiveDrawing: other cases", () => {
  it("explains that Live Drawing applies to Race for other competition types", async () => {
    state.typeId = "tt";
    renderScreen();
    expect(
      await screen.findByText(
        /Drawing is only available for Race competitions/,
      ),
    ).toBeInTheDocument();
    expect(getDrawing).not.toHaveBeenCalled();
  });

  it("shows a retryable error when the drawing cannot be loaded", async () => {
    vi.mocked(getDrawing).mockRejectedValueOnce(new Error("Server down"));
    renderScreen();
    expect(await screen.findByText("Server down")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
