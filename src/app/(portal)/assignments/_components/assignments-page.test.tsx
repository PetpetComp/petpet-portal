import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEvent } from "@/domains/events/api";
import { eventFixture } from "@/test/event-fixtures";
import { AssignmentsPage } from "./assignments-page";

const { auth } = vi.hoisted(() => ({
  auth: { current: {} as Record<string, unknown> },
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth.current }));
vi.mock("@/domains/events/api", () => ({ getEvent: vi.fn() }));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({
        id: "c1",
        eventId: "e1",
        name: "Paw Sprint 100M",
        typeId: "race",
        status: "ONGOING",
      }),
      competitionFixture({
        id: "c2",
        eventId: "e1",
        name: "Best Costume",
        typeId: "contest",
        status: "SCHEDULED",
      }),
    ]),
    listCompetitionTypes: vi.fn().mockResolvedValue([
      { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      {
        id: "contest",
        code: "BEAUTY",
        name: "Beauty",
        resultMode: "JUDGED_SCORE",
      },
    ]),
    listCompetitionRules: vi
      .fn()
      .mockResolvedValue([{ id: "r1", isActive: true, laneTotal: 5 }]),
  };
});
vi.mock("@/domains/drawing/api", () => ({
  getDrawing: vi.fn().mockResolvedValue({
    competitionId: "c1",
    locked: true,
    lanes: 5,
    matches: [
      { id: "m1", number: 1, status: "COMPLETED", lanes: [] },
      { id: "m2", number: 2, status: "SCHEDULED", lanes: [] },
    ],
  }),
}));
vi.mock("@/domains/staff/api", async () => {
  const { FALLBACK_ASSIGNMENT_ROLES, roleFromApi } =
    await import("@/domains/staff/types");
  return {
    getAssignmentRoles: vi
      .fn()
      .mockResolvedValue(FALLBACK_ASSIGNMENT_ROLES.map(roleFromApi)),
  };
});

const HOUR = 60 * 60 * 1000;
/** Event yang sedang berlangsung sekarang, jadi pasti "hari ini". */
const todayEvent = () =>
  eventFixture({
    id: "e1",
    name: "Surabaya Paw Race 2026",
    startAt: new Date(Date.now() - HOUR).toISOString(),
    endAt: new Date(Date.now() + 5 * HOUR).toISOString(),
  });
/** Event seminggu lagi: penugasannya tidak boleh muncul hari ini. */
const nextWeekEvent = () =>
  eventFixture({
    id: "e1",
    name: "Surabaya Paw Race 2026",
    startAt: new Date(Date.now() + 7 * 24 * HOUR).toISOString(),
    endAt: new Date(Date.now() + 8 * 24 * HOUR).toISOString(),
  });

const FOOTER = "Only competitions you are assigned to appear here.";

function renderPage(
  assignments: {
    eventId: string;
    competitionId: string | null;
    role: string;
  }[],
) {
  auth.current = {
    loading: false,
    user: { name: "Farhan Hidayat" },
    assignments,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AssignmentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AssignmentsPage", () => {
  it("shows a card with role, name, progress and the Live Mode link, plus the role guide", async () => {
    vi.mocked(getEvent).mockResolvedValue(todayEvent());
    renderPage([
      { eventId: "e1", competitionId: "c1", role: "COMPETITION_PIC" },
    ]);

    expect(
      screen.getByRole("heading", { name: "My assignments" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hi, Farhan")).toBeInTheDocument();

    expect(await screen.findByText("Paw Sprint 100M")).toBeInTheDocument();
    expect(screen.getByText("Today - Surabaya Paw Race 2026")).toBeVisible();
    expect(await screen.findByText("Race - Competition PIC")).toBeVisible();
    expect(screen.getByText("Live")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Match 2 of 2 - 5 lanes")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: /Open Live Mode/ }),
    ).toHaveAttribute("href", "/live/c1");

    expect(
      screen.getByText("Your role as Competition PIC"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Start each match, record finishes per lane/),
    ).toBeInTheDocument();
    expect(screen.getByText(FOOTER)).toBeInTheDocument();
    // Kompetisi lain di event itu bukan milik akun ini.
    expect(screen.queryByText("Best Costume")).not.toBeInTheDocument();
  });

  it("lists every competition for an event-level assignment and explains each role once", async () => {
    vi.mocked(getEvent).mockResolvedValue(todayEvent());
    renderPage([{ eventId: "e1", competitionId: null, role: "EVENT_MANAGER" }]);

    expect(await screen.findByText("Paw Sprint 100M")).toBeInTheDocument();
    expect(screen.getByText("Best Costume")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Open Live Mode/ }),
    ).toHaveLength(2);
    expect(
      await screen.findAllByText("Your role as Event manager"),
    ).toHaveLength(1);
  });

  it("shows the empty state when the assigned event is not today", async () => {
    vi.mocked(getEvent).mockResolvedValue(nextWeekEvent());
    renderPage([
      { eventId: "e1", competitionId: "c1", role: "COMPETITION_PIC" },
    ]);

    expect(await screen.findByText("No assignment today")).toBeInTheDocument();
    expect(screen.queryByText("Paw Sprint 100M")).not.toBeInTheDocument();
    expect(screen.getByText(FOOTER)).toBeInTheDocument();
  });

  it("shows the empty state for an account without any assignment", async () => {
    renderPage([]);

    expect(await screen.findByText("No assignment today")).toBeInTheDocument();
    expect(getEvent).not.toHaveBeenCalled();
  });

  it("shows an error with a retry button when the event cannot be loaded", async () => {
    vi.mocked(getEvent).mockRejectedValue(new Error("Event is unreachable"));
    renderPage([
      { eventId: "e1", competitionId: "c1", role: "COMPETITION_PIC" },
    ]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Event is unreachable",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
