import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { getCompetition } from "@/domains/competitions/api";
import { CompetitionShell, competitionTabs } from "./competition-shell";

const auth = vi.hoisted(() => ({ canUpdate: true }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/event-management/e1/competitions/c1",
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ canOnEvent: () => auth.canUpdate }),
}));
vi.mock("@/domains/events/api", async () => {
  const { eventFixture } = await import("@/test/event-fixtures");
  return {
    getEvent: vi.fn().mockResolvedValue(eventFixture()),
    countEventEntries: vi.fn().mockResolvedValue(45),
  };
});
vi.mock("@/domains/staff/api", () => ({
  getEventStaff: vi.fn().mockResolvedValue([
    { id: "a1", competitionId: "c1", name: "Nadia", role: "PIC" },
    { id: "a2", competitionId: "c1", name: "Rani", role: "PIC" },
    { id: "a3", competitionId: null, name: "Event lead", role: "MANAGER" },
  ]),
}));
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    getCompetition: vi.fn().mockResolvedValue(
      competitionFixture({
        id: "c1",
        eventId: "e1",
        typeId: "race",
        speciesId: "sp1",
        name: "Paw Sprint 100M",
        status: "ONGOING",
      }),
    ),
    listCompetitionTypes: vi
      .fn()
      .mockResolvedValue([
        { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      ]),
    listSpecies: vi
      .fn()
      .mockResolvedValue([{ id: "sp1", name: "Sugar Glider" }]),
    listCompetitionRules: vi.fn().mockResolvedValue([
      {
        id: "r1",
        version: 1,
        isActive: true,
        laneTotal: 5,
        timeLimitMs: 90000,
      },
    ]),
  };
});

function renderShell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CompetitionShell eventId="e1" competitionId="c1">
        <p>tab content</p>
      </CompetitionShell>
    </QueryClientProvider>,
  );
}

describe("competitionTabs", () => {
  const tabs = competitionTabs("e1", "c1", {
    participants: 45,
    committee: null,
  });

  it("has the five tabs of the design, in order", () => {
    expect(tabs.map((t) => t.label)).toEqual([
      "Overview",
      "Participants",
      "Committee",
      "Settings",
      "Results",
    ]);
  });
  it("points every tab inside the competition", () => {
    const base = "/event-management/e1/competitions/c1";
    expect(tabs.map((t) => t.href)).toEqual([
      base,
      base + "/participants",
      base + "/committee",
      base + "/settings",
      base + "/results",
    ]);
    expect(tabs[0].exact).toBe(true);
  });
  it("carries the counts, leaving out the ones that could not be loaded", () => {
    expect(tabs[1].count).toBe(45);
    expect(tabs[2].count).toBeNull();
  });
});

describe("CompetitionShell", () => {
  it("shows the header of the design with counts taken from the existing queries", async () => {
    auth.canUpdate = true;
    renderShell();
    expect(
      await screen.findByRole("heading", { name: "Paw Sprint 100M" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Race")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(await screen.findByText("Sugar Glider")).toBeInTheDocument();
    expect(await screen.findByText("45 participants")).toBeInTheDocument();
    expect(await screen.findByText("5 lanes")).toBeInTheDocument();
    expect(screen.getByText("Cut-off 01:30")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Committee/ })).toHaveTextContent(
        "Committee2",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Participants/ }),
      ).toHaveTextContent("Participants45"),
    );
    expect(screen.getByText("tab content")).toBeInTheDocument();
  });

  it("links Edit to the edit page and Open Live Mode to Live Mode", async () => {
    auth.canUpdate = true;
    renderShell();
    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/event-management/e1/competitions/c1/edit",
    );
    expect(
      await screen.findByRole("link", { name: /Open Live Mode/ }),
    ).toHaveAttribute("href", "/live/c1");
  });

  it("disables Open Live Mode for a cancelled competition", async () => {
    const { competitionFixture } = await import("@/test/fixtures");
    vi.mocked(getCompetition).mockResolvedValueOnce(
      competitionFixture({
        id: "c1",
        eventId: "e1",
        typeId: "race",
        name: "Paw Sprint 100M",
        status: "CANCELLED",
      }),
    );
    renderShell();
    await screen.findByRole("heading", { name: "Paw Sprint 100M" });
    expect(screen.queryByRole("link", { name: /Open Live Mode/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Open Live Mode/ }),
    ).toBeDisabled();
  });

  it("hides Edit from someone who may not update competitions", async () => {
    auth.canUpdate = false;
    renderShell();
    await screen.findByRole("heading", { name: "Paw Sprint 100M" });
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("shows not found instead of the tabs when the API answers 404", async () => {
    vi.mocked(getCompetition).mockRejectedValueOnce(
      new ApiError(404, "Competition not found."),
    );
    renderShell();
    expect(
      await screen.findByText("Competition not found."),
    ).toBeInTheDocument();
    expect(screen.queryByText("tab content")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to competitions" }),
    ).toHaveAttribute("href", "/event-management/e1/competitions");
  });

  it("shows the no-access page when the API answers 403", async () => {
    vi.mocked(getCompetition).mockRejectedValueOnce(new ApiError(403, "No"));
    renderShell();
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });
});
