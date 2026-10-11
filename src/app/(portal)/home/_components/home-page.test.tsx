import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEvents } from "@/domains/events/api";
import { eventFixture, eventPageFixture } from "@/test/event-fixtures";
import { HomePage } from "./home-page";

const { auth, replace } = vi.hoisted(() => ({
  auth: {
    current: {} as Record<string, unknown>,
  },
  replace: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth.current }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/domains/events/api", () => ({ listEvents: vi.fn() }));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({
        id: "c1",
        name: "Paw Sprint 100M",
        typeId: "race",
        status: "ONGOING",
      }),
      competitionFixture({
        id: "c2",
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

const HOUR = 60 * 60 * 1000;
/** Event yang sedang berlangsung sekarang, jadi pasti "hari ini". */
const todayEvent = () =>
  eventFixture({
    id: "e-today",
    name: "Surabaya Paw Race 2026",
    startAt: new Date(Date.now() - HOUR).toISOString(),
    endAt: new Date(Date.now() + 5 * HOUR).toISOString(),
  });
/** Event tiga hari lagi. */
const laterEvent = () =>
  eventFixture({
    id: "e-later",
    name: "Jakarta Pet Festival 2026",
    venueName: "JIExpo Kemayoran",
    startAt: new Date(Date.now() + 3 * 24 * HOUR).toISOString(),
    endAt: new Date(Date.now() + 4 * 24 * HOUR).toISOString(),
  });

/** Akun organizer: boleh `event.update`, tidak super admin. */
const organizer = {
  loading: false,
  user: { name: "Dian Kusuma" },
  assignments: [],
  memberships: [{ organizationId: "o1", role: "ADMIN" }],
  can: (permission: string) => permission === "event.update",
};

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <HomePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = organizer;
});

describe("HomePage", () => {
  it("shows the live card, today's competitions and Coming up on an event day", async () => {
    vi.mocked(listEvents).mockResolvedValue(
      eventPageFixture([todayEvent(), laterEvent()]),
    );
    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Today is event day" }),
    ).toBeInTheDocument();
    const live = await screen.findByRole("region", {
      name: "Live now: Paw Sprint 100M",
    });
    await waitFor(() =>
      expect(live).toHaveTextContent("Match 2 of 2 - 5 lanes"),
    );
    expect(
      screen.getByRole("link", { name: /Open Live Mode/ }),
    ).toHaveAttribute("href", "/live/c1");
    expect(await screen.findByText("Best Costume")).toBeInTheDocument();
    expect(screen.getByText("Jakarta Pet Festival 2026")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the empty state with the next events when nothing runs today", async () => {
    vi.mocked(listEvents).mockResolvedValue(eventPageFixture([laterEvent()]));
    renderHome();

    expect(await screen.findByText("No event today")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Events" })).toHaveAttribute(
      "href",
      "/event-management",
    );
    expect(screen.getByText("Jakarta Pet Festival 2026")).toBeInTheDocument();
    expect(screen.getByText(/in 3 days/)).toBeInTheDocument();
    expect(screen.queryByText(/Live now/)).not.toBeInTheDocument();
  });

  it("redirects a user with only assignments to My assignments", async () => {
    auth.current = {
      ...organizer,
      can: () => false,
      assignments: [
        { eventId: "e-today", competitionId: "c1", role: "COMPETITION_PIC" },
      ],
    };
    renderHome();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/assignments"));
    expect(listEvents).not.toHaveBeenCalled();
    expect(screen.queryByText("No event today")).not.toBeInTheDocument();
  });

  it("waits for the access profile before deciding", () => {
    auth.current = { ...organizer, loading: true, can: () => false };
    renderHome();

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps an organizer who also has assignments on Home", async () => {
    auth.current = {
      ...organizer,
      assignments: [{ eventId: "e-today", competitionId: "c1", role: "JUDGE" }],
    };
    vi.mocked(listEvents).mockResolvedValue(eventPageFixture([laterEvent()]));
    renderHome();

    expect(await screen.findByText("No event today")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
