import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { getDrawing, lockDrawing, swapDrawing } from "@/domains/drawing/api";
import { buildDrawing } from "@/domains/drawing/draw";
import { drawingKeys } from "@/domains/drawing/keys";
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
      {
        id: "other",
        code: "CONTEST",
        name: "Contest",
        resultMode: "JUDGED_SCORE",
      },
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
  buildQueue: vi.fn(),
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
  const result = render(
    <QueryClientProvider client={client}>
      <LiveDrawing competitionId="c1" />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

/** Menekan "Start drawing" (undian pertama). */
function startDrawing() {
  fireEvent.click(screen.getByRole("button", { name: "Start drawing" }));
}

const match = (n: number) => screen.getByRole("region", { name: `Match ${n}` });

/** Mengatur window.matchMedia: `reduced` = true berarti pengguna memilih prefers-reduced-motion. */
function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

beforeEach(() => {
  // Bawaan: reduced motion, supaya Shuffle langsung menampilkan hasil (deterministik).
  mockReducedMotion(true);
  state.typeId = "race";
  state.push.mockReset();
  vi.mocked(getDrawing).mockReset().mockResolvedValue(drawing());
  vi.mocked(lockDrawing).mockReset();
  vi.mocked(swapDrawing).mockReset();
  vi.mocked(buildDrawing).mockReset().mockReturnValue(FIRST_DRAW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LiveDrawing: not drawn yet (draft)", () => {
  it("starts in a pending state: structure only, no names, no chips, Lock disabled", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    expect(buildDrawing).not.toHaveBeenCalled();
    // Kerangka: 5 peserta / 3 lane -> 2 match berukuran 3 dan 2, tanpa nama.
    expect(match(1)).toHaveTextContent("?");
    expect(match(1)).not.toHaveTextContent("Pet1");
    expect(within(match(1)).getAllByRole("listitem")).toHaveLength(3);
    expect(within(match(2)).getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByText("matches").previousElementSibling,
    ).toHaveTextContent("2");
    // Panel Participants: nama ada, chip posisi belum ada.
    const panel = screen.getByRole("region", { name: "Participants" });
    expect(within(panel).getByText("Pet1")).toBeInTheDocument();
    expect(within(panel).queryByText(/Match \d+ - Lane/)).toBeNull();
    // Arena: jalur kosong menunggu undian.
    const arena = screen.getByRole("region", { name: "Arena preview" });
    expect(within(arena).getByText("Waiting for the draw")).toBeInTheDocument();
    expect(within(arena).queryByText("Pet1")).toBeNull();
    expect(
      within(arena)
        .getAllByRole("listitem")
        .every((li) => li.dataset.laneState === "pending"),
    ).toBe(true);
    // Aksi: Start drawing menggantikan Shuffle again, Lock nonaktif dengan petunjuk.
    expect(screen.getByRole("button", { name: "Start drawing" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Shuffle again" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Lock drawing & go to matches/ }),
    ).toBeDisabled();
    expect(screen.getByText("Start the drawing first")).toBeInTheDocument();
  });

  it("draws on Start drawing, then offers Shuffle again and an enabled Lock", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    startDrawing();
    expect(buildDrawing).toHaveBeenCalledWith(
      ["e1", "e2", "e3", "e4", "e5"],
      3,
    );
    await waitFor(() => expect(match(1)).toHaveTextContent(/Pet1.*Pet2.*Pet3/));
    expect(screen.getByRole("button", { name: "Shuffle again" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Start drawing" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Lock drawing & go to matches/ }),
    ).toBeEnabled();
    expect(screen.queryByText("Start the drawing first")).toBeNull();
    const panel = screen.getByRole("region", { name: "Participants" });
    expect(within(panel).getByText("Match 1 - Lane 1")).toBeInTheDocument();
  });

  it("goes back to pending when the eligible participants change", async () => {
    const { client } = renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    startDrawing();
    await waitFor(() => expect(match(1)).toHaveTextContent(/Pet1/));
    vi.mocked(getDrawing).mockResolvedValue(
      drawing({ participants: participants(4) }),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: drawingKeys.all });
    });
    await waitFor(() =>
      expect(
        screen.getByText("checked in").previousElementSibling,
      ).toHaveTextContent("4"),
    );
    expect(screen.getByRole("button", { name: "Start drawing" })).toBeEnabled();
    expect(match(1)).not.toHaveTextContent("Pet1");
    expect(
      screen.getByRole("button", { name: /Lock drawing & go to matches/ }),
    ).toBeDisabled();
  });

  it("shows a draft built from the eligible participants with the stats", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    startDrawing();
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
    startDrawing();
    await waitFor(() => expect(match(1)).toHaveTextContent(/Pet1.*Pet2.*Pet3/));
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
    await screen.findByRole("region", { name: "Match 1" });
    startDrawing();
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
    startDrawing();
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
  it("explains that Live Drawing applies to Race and Time trial for other competition types", async () => {
    state.typeId = "other";
    renderScreen();
    expect(
      await screen.findByText(
        /Drawing is only available for Race and Time trial competitions/,
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

describe("LiveDrawing: shuffle reveal animation", () => {
  const lockButton = () =>
    screen.getByRole("button", { name: /Lock drawing & go to matches/ });
  const slots = (n: number) => Array.from(match(n).querySelectorAll("li"));
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  /** Render, tunggu draf awal, lalu pakai fake timers dan tekan Shuffle again. */
  async function startShuffle() {
    mockReducedMotion(false);
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    // Sebelum Start drawing tidak ada slot yang berputar (kerangka "?").
    expect(document.querySelector('[data-slot-state="spinning"]')).toBeNull();
    vi.mocked(buildDrawing).mockReturnValueOnce(SECOND_DRAW);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start drawing" }));
  }

  it("spins with cycling names, blocks Lock and Shuffle, and marks the grid busy", async () => {
    await startShuffle();
    expect(slots(1).every((li) => li.dataset.slotState === "spinning")).toBe(
      true,
    );
    expect(lockButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Shuffle again" }),
    ).toBeDisabled();
    expect(match(1).parentElement).toHaveAttribute("aria-busy", "true");

    const seen = new Set<string>();
    for (let tick = 0; tick < 7; tick += 1) {
      advance(70);
      seen.add(slots(1)[0].textContent ?? "");
    }
    expect(seen.size).toBeGreaterThan(1);
    // Nama yang berputar tidak boleh terbaca pembaca layar.
    expect(slots(1)[0].querySelector("[aria-hidden]")).not.toBeNull();
  });

  it("settles slots one by one in reading order, then announces completion", async () => {
    await startShuffle();
    advance(700);
    expect(slots(1)[0].dataset.slotState).toBe("settled");
    expect(slots(1)[0]).toHaveTextContent("Pet5");
    expect(slots(1)[1].dataset.slotState).toBe("spinning");
    expect(slots(2)[0].dataset.slotState).toBe("spinning");

    advance(1500);
    expect(document.querySelector('[data-slot-state="spinning"]')).toBeNull();
    expect(match(1)).toHaveTextContent(/Pet5.*Pet4.*Pet3/);
    expect(match(2)).toHaveTextContent(/Pet2.*Pet1/);
    expect(lockButton()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Skip animation" })).toBeNull();
    expect(screen.getByText("Drawing complete, 2 matches")).toBeInTheDocument();
    expect(match(1).parentElement).toHaveAttribute("aria-busy", "false");
  });

  it("jumps straight to the final result on Skip animation", async () => {
    await startShuffle();
    fireEvent.click(screen.getByRole("button", { name: "Skip animation" }));
    expect(document.querySelector('[data-slot-state="spinning"]')).toBeNull();
    expect(match(1)).toHaveTextContent(/Pet5.*Pet4.*Pet3/);
    expect(lockButton()).toBeEnabled();
    expect(screen.getByText("Drawing complete, 2 matches")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip animation" })).toBeNull();
  });

  it("shows the result at once without Skip when reduced motion is on", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    vi.mocked(buildDrawing).mockReturnValueOnce(SECOND_DRAW);
    startDrawing();
    expect(document.querySelector('[data-slot-state="spinning"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip animation" })).toBeNull();
    expect(match(1)).toHaveTextContent(/Pet5.*Pet4.*Pet3/);
  });

  it("shows each participant's Match and Lane in the Participants panel after the draw", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Match 1" });
    startDrawing();
    const panel = screen.getByRole("region", { name: "Participants" });
    expect(within(panel).getByText("Match 1 - Lane 1")).toBeInTheDocument();
    expect(within(panel).getByText("Match 2 - Lane 2")).toBeInTheDocument();
  });
});
