import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDrawing, lockDrawing, swapDrawing } from "@/domains/drawing/api";
import { buildQueue } from "@/domains/drawing/draw";
import type {
  CompetitionDrawing,
  DrawingParticipant,
} from "@/domains/drawing/types";
import { LiveDrawing } from "../live-drawing";

const state = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    getCompetition: vi.fn(async () =>
      competitionFixture({ id: "c1", typeId: "tt" }),
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
// Hanya buildQueue yang diganti (supaya hasil undian bisa ditentukan); sisanya asli.
vi.mock("@/domains/drawing/draw", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/drawing/draw")>()),
  buildQueue: vi.fn(),
}));

/** Urutan hasil undian palsu: SATU match berisi semua peserta. */
const DRAWN = [["e3", "e1", "e4", "e2"]];

/** Peserta e1..en: Pet1/Owner1/001, dst. */
function participants(n: number): DrawingParticipant[] {
  return Array.from({ length: n }, (_, i) => ({
    entryId: `e${i + 1}`,
    petName: `Pet${i + 1}`,
    ownerName: `Owner${i + 1}`,
    bibNumber: `00${i + 1}`,
  }));
}

/** Drawing Time trial yang belum di-lock: `lanes` = jumlah peserta (kontrak 14). */
function draftDrawing(): CompetitionDrawing {
  return {
    competitionId: "c1",
    locked: false,
    lanes: 4,
    lockedAt: null,
    lockedByName: null,
    participants: participants(4),
    matches: [],
    lockBlockedReason: null,
    actions: { lock: true, swap: false },
  };
}

/** Drawing terkunci: satu match "round-c1-1" dengan posisi 1..4 menurut DRAWN. */
function lockedDrawing(swap = true): CompetitionDrawing {
  const all = participants(4);
  return {
    ...draftDrawing(),
    locked: true,
    lockedAt: "2026-10-11T07:00:00+00:00",
    lockedByName: "Organizer Demo",
    participants: all,
    matches: [
      {
        id: "round-c1-1",
        number: 1,
        status: "SCHEDULED",
        lanes: DRAWN[0].map((entryId, index) => ({
          ...all.find((p) => p.entryId === entryId)!,
          laneNumber: index + 1,
        })),
      },
    ],
    lockBlockedReason: "ALREADY_LOCKED",
    actions: { lock: false, swap },
  };
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

/** Reduced motion aktif supaya Start drawing langsung menampilkan hasil (deterministik). */
function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: true,
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

const card = () => screen.getByRole("region", { name: "Running order" });
const LOCK_NAME = /Lock running order & go to run/;

beforeEach(() => {
  mockReducedMotion();
  state.push.mockReset();
  vi.mocked(getDrawing).mockReset().mockResolvedValue(draftDrawing());
  vi.mocked(lockDrawing).mockReset();
  vi.mocked(swapDrawing).mockReset();
  vi.mocked(buildQueue).mockReset().mockReturnValue(DRAWN);
});

describe("Running order (Time trial drawing): draft", () => {
  it("starts pending with one Running order card, queue stats and no lanes, matches or Arena", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Running order" });
    expect(buildQueue).not.toHaveBeenCalled();
    // Satu kartu, empat posisi, tanpa nama.
    expect(within(card()).getAllByRole("listitem")).toHaveLength(4);
    expect(card()).toHaveTextContent("?");
    expect(card()).not.toHaveTextContent("Pet1");
    expect(screen.queryByRole("region", { name: /^Match/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Arena preview" })).toBeNull();
    // Statistik: checked in dan in the queue saja.
    expect(
      screen.getByText("checked in").previousElementSibling,
    ).toHaveTextContent("4");
    expect(
      screen.getByText("in the queue").previousElementSibling,
    ).toHaveTextContent("4");
    expect(screen.queryByText("lanes")).toBeNull();
    expect(screen.queryByText("matches")).toBeNull();
    expect(
      screen.getByText(/Press Start drawing to draw the running order/),
    ).toBeInTheDocument();
    // Aksi: Start drawing aktif, Lock nonaktif.
    expect(screen.getByRole("button", { name: "Start drawing" })).toBeEnabled();
    expect(screen.getByRole("button", { name: LOCK_NAME })).toBeDisabled();
    // Panel Participants belum punya chip posisi.
    const panel = screen.getByRole("region", { name: "Participants" });
    expect(within(panel).queryByText(/Position \d/)).toBeNull();
  });

  it("draws one queue on Start drawing and shows positions and Position chips", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Running order" });
    fireEvent.click(screen.getByRole("button", { name: "Start drawing" }));
    expect(buildQueue).toHaveBeenCalledWith(["e1", "e2", "e3", "e4"]);
    await waitFor(() =>
      expect(card()).toHaveTextContent(/Pet3.*Pet1.*Pet4.*Pet2/),
    );
    const items = within(card()).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("1");
    expect(items[0]).toHaveTextContent("Pet3");
    expect(items[0]).toHaveTextContent("Owner3");
    const panel = screen.getByRole("region", { name: "Participants" });
    expect(within(panel).getByText("Position 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shuffle again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: LOCK_NAME })).toBeEnabled();
    // Draf hanya hasil lokal: belum ada yang disimpan.
    expect(lockDrawing).not.toHaveBeenCalled();
  });

  it("locks the single queue and goes to the Run tab", async () => {
    vi.mocked(lockDrawing).mockResolvedValue(lockedDrawing());
    renderScreen();
    await screen.findByRole("region", { name: "Running order" });
    fireEvent.click(screen.getByRole("button", { name: "Start drawing" }));
    fireEvent.click(await screen.findByRole("button", { name: LOCK_NAME }));
    await waitFor(() =>
      expect(state.push).toHaveBeenCalledWith("/live/c1/matches"),
    );
    expect(lockDrawing).toHaveBeenCalledWith("c1", DRAWN);
  });
});

describe("Running order (Time trial drawing): locked", () => {
  it("swaps two positions with a confirmation", async () => {
    vi.mocked(getDrawing).mockResolvedValue(lockedDrawing());
    vi.mocked(swapDrawing).mockResolvedValue(lockedDrawing());
    renderScreen();
    fireEvent.click(
      await screen.findByRole("button", { name: "Position 1, Pet3" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Position 3, Pet4" }));
    expect(
      screen.getByText("Pet3 (Position 1)", { exact: false }),
    ).toBeInTheDocument();
    expect(swapDrawing).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm swap" }));
    await waitFor(() =>
      expect(swapDrawing).toHaveBeenCalledWith("c1", "e3", "e4"),
    );
  });

  it("shows the locked order read-only with a link to the Run tab", async () => {
    vi.mocked(getDrawing).mockResolvedValue(lockedDrawing(false));
    renderScreen();
    expect(await screen.findByText("Locked")).toBeInTheDocument();
    expect(card()).toHaveTextContent(/Pet3.*Pet1.*Pet4.*Pet2/);
    expect(screen.queryByRole("button", { name: /Position/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Go to run" })).toHaveAttribute(
      "href",
      "/live/c1/matches",
    );
    expect(buildQueue).not.toHaveBeenCalled();
  });
});
