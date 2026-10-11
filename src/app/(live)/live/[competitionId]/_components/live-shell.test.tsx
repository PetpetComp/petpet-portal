import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { getCompetition } from "@/domains/competitions/api";
import { getQueue } from "@/domains/timetrial/api";
import type { Queue } from "@/domains/timetrial/types";
import { listEventSponsorLinks } from "@/domains/sponsors/api";
import { competitionFixture } from "@/test/fixtures";
import { LiveShell, liveTabs } from "./live-shell";

const nav = vi.hoisted(() => ({ pathname: "/live/c1/drawing" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));
vi.mock("@/domains/events/api", async () => {
  const { eventFixture } = await import("@/test/event-fixtures");
  return { getEvent: vi.fn().mockResolvedValue(eventFixture()) };
});
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    getCompetition: vi.fn().mockResolvedValue(
      competitionFixture({
        id: "c1",
        eventId: "e1",
        name: "Paw Sprint 100M",
        typeId: "race",
      }),
    ),
    listCompetitionTypes: vi.fn().mockResolvedValue([
      { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      { id: "tt", code: "TIME_TRIAL", name: "Time trial", resultMode: "TIME" },
    ]),
  };
});
vi.mock("@/domains/timetrial/api", () => ({ getQueue: vi.fn() }));
vi.mock("@/domains/sponsors/api", () => ({
  listEventSponsorLinks: vi.fn().mockResolvedValue([
    {
      id: "l1",
      eventId: "e1",
      brandId: "b2",
      level: "SILVER",
      campaignText: null,
      displayOrder: 0,
    },
    {
      id: "l2",
      eventId: "e1",
      brandId: "b1",
      level: "PLATINUM",
      campaignText: null,
      displayOrder: 0,
    },
  ]),
  listBrands: vi.fn().mockResolvedValue([
    { id: "b1", name: "Alpha Pet Food", phone: null, email: null },
    { id: "b2", name: "Beta Toys", phone: null, email: null },
  ]),
}));

/** Mengatur nilai navigator.onLine untuk satu tes. */
function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

function renderShell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LiveShell competitionId="c1">
        <p>step content</p>
      </LiveShell>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nav.pathname = "/live/c1/drawing";
  setOnLine(true);
});
afterEach(() => setOnLine(true));

describe("liveTabs", () => {
  it("lists the three steps with real routes", () => {
    expect(liveTabs("c1").map((t) => [t.label, t.href])).toEqual([
      ["Drawing", "/live/c1/drawing"],
      ["Matches", "/live/c1/matches"],
      ["Results", "/live/c1/results"],
    ]);
  });

  it("renames the steps for a Time trial and keeps the same routes", () => {
    expect(liveTabs("c1", true).map((t) => [t.label, t.href])).toEqual([
      ["Running order", "/live/c1/drawing"],
      ["Run", "/live/c1/matches"],
      ["Results", "/live/c1/results"],
    ]);
  });
});

/** Antrean seminimal: hanya `rules` yang dibaca header. */
function queueWithLimit(attemptLimit: number): Queue {
  return {
    competitionId: "c1",
    roundId: "r1",
    drawingLocked: false,
    rules: {
      attemptLimit,
      cutoffMs: 120000,
      countdownSeconds: 3,
      rankingRule: [],
    },
    currentEntryId: null,
    participants: [],
    summary: { total: 0, notStarted: 0, inProgress: 0, done: 0, dns: 0, dq: 0 },
    finished: false,
  };
}

describe("LiveShell: Time trial", () => {
  beforeEach(() => {
    vi.mocked(getCompetition).mockResolvedValueOnce(
      competitionFixture({
        id: "c1",
        eventId: "e1",
        name: "Quick Paw Time Trial",
        typeId: "tt",
      }),
    );
    vi.mocked(getQueue).mockReset().mockResolvedValue(queueWithLimit(3));
  });

  it("shows the Running order, Run and Results tabs and the Running order subtitle", async () => {
    renderShell();
    expect(
      await screen.findByRole("link", { name: "1 Running order" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "2 Run" })).toHaveAttribute(
      "href",
      "/live/c1/matches",
    );
    expect(screen.getByRole("link", { name: "3 Results" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "1 Drawing" })).toBeNull();
    expect(screen.getByText("Running order")).toBeInTheDocument();
  });

  it("shows best of N attempts from the rule on the other steps", async () => {
    nav.pathname = "/live/c1/matches";
    renderShell();
    expect(
      await screen.findByText("Time trial - best of 3 attempts"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2 Run" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("LiveShell", () => {
  it("shows title, subtitle, back button and the three tabs with the current one marked", async () => {
    renderShell();
    expect(
      await screen.findByRole("heading", { name: "Paw Sprint 100M" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Drawing - Round 1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Exit Live Mode" }),
    ).toHaveAttribute("href", "/event-management/e1/competitions/c1");
    expect(screen.getByRole("link", { name: "1 Drawing" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "2 Matches" })).toHaveAttribute(
      "href",
      "/live/c1/matches",
    );
    expect(screen.getByRole("link", { name: "3 Results" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByText("step content")).toBeInTheDocument();
  });

  it("shows the event name as subtitle on the other steps", async () => {
    nav.pathname = "/live/c1/matches";
    renderShell();
    expect(
      await screen.findByText("Surabaya Paw Race 2026"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2 Matches" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps the Matches tab active on the Run match screen", async () => {
    nav.pathname = "/live/c1/matches/heat-1";
    renderShell();
    await screen.findByRole("heading", { name: "Paw Sprint 100M" });
    expect(screen.getByRole("link", { name: "2 Matches" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "1 Drawing" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows a quiet Connected state, then a clear Offline state and back", async () => {
    renderShell();
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    setOnLine(false);
    act(() => {
      fireEvent.offline(window);
    });
    expect(
      screen.getByText("Offline - actions will not be sent"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Connected")).toBeNull();
    setOnLine(true);
    act(() => {
      fireEvent.online(window);
    });
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("lists the sponsors by tier, highest first", async () => {
    renderShell();
    expect(await screen.findByText("SUPPORTED BY")).toBeInTheDocument();
    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(names).toEqual(["Alpha Pet Food", "Beta Toys"]);
  });

  it("hides the sponsor strip when the event has none", async () => {
    vi.mocked(listEventSponsorLinks).mockResolvedValueOnce([]);
    renderShell();
    await screen.findByRole("heading", { name: "Paw Sprint 100M" });
    expect(screen.queryByText("SUPPORTED BY")).toBeNull();
  });

  it("shows the no-access page when the API answers 403", async () => {
    vi.mocked(getCompetition).mockRejectedValueOnce(new ApiError(403, "No"));
    renderShell();
    expect(await screen.findByText("No access")).toBeInTheDocument();
    expect(screen.queryByText("step content")).toBeNull();
  });

  it("shows not found without a retry button when the API answers 404", async () => {
    vi.mocked(getCompetition).mockRejectedValueOnce(
      new ApiError(404, "Competition not found."),
    );
    renderShell();
    expect(
      await screen.findByText("Competition not found."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText("step content")).toBeNull();
  });

  it("offers Try again for other errors", async () => {
    vi.mocked(getCompetition).mockRejectedValueOnce(new Error("Boom"));
    renderShell();
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
