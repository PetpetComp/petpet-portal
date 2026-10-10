import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { EventOverview } from "./event-overview";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ can: () => true, canOnEvent: () => true }),
}));
vi.mock("@/domains/events/api", async () => {
  const { eventFixture } = await import("@/test/event-fixtures");
  return {
    getEvent: vi
      .fn()
      .mockResolvedValue(eventFixture({ status: "DRAFT", phase: "DRAFT" })),
    countEventStaff: vi.fn().mockResolvedValue(3),
    // Akun ini tidak boleh melihat sponsor: endpoint menjawab 403.
    getEventSponsorLevels: vi
      .fn()
      .mockRejectedValue(new Error("You are not a member")),
    // 12 peserta untuk kompetisi c1, 4 untuk c2, 16 total.
    countEventEntries: vi.fn(async (_event: string, competitionId?: string) =>
      competitionId === "c1" ? 12 : competitionId === "c2" ? 4 : 16,
    ),
    publishEvent: vi.fn(),
  };
});
vi.mock("@/domains/competitions/api", async () => {
  const { competitionFixture } = await import("@/test/fixtures");
  return {
    listEventCompetitions: vi.fn().mockResolvedValue([
      competitionFixture({ id: "c1", name: "Paw Sprint", typeId: "race" }),
      competitionFixture({
        id: "c2",
        name: "Quick Time Trial",
        typeId: "tt",
      }),
    ]),
    listCompetitionTypes: vi.fn().mockResolvedValue([
      { id: "race", code: "RACE", name: "Race", resultMode: "POSITION" },
      { id: "tt", code: "TT", name: "Time trial", resultMode: "TIME" },
    ]),
  };
});

function renderOverview() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EventOverview eventId="e1" />
    </QueryClientProvider>,
  );
}

describe("EventOverview", () => {
  it("shows the three cards, participants per competition and the setup checklist", async () => {
    renderOverview();
    expect(
      await screen.findByText("1 race · 1 time trial"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("entries across all competitions"),
    ).toBeInTheDocument();
    expect(await screen.findByText("16")).toBeInTheDocument();

    const bars = screen.getByRole("heading", {
      name: "Participants per competition",
    }).parentElement!;
    expect(
      await within(bars).findByRole("img", {
        name: "Paw Sprint: 12 participants",
      }),
    ).toBeInTheDocument();
    expect(
      within(bars).getByRole("img", {
        name: "Quick Time Trial: 4 participants",
      }),
    ).toBeInTheDocument();

    const setup = screen.getByRole("heading", { name: "Setup" }).parentElement!;
    const step = (name: string) => within(setup).getByText(name).parentElement!;
    expect(
      await within(step("2 competitions added")).findByLabelText("Done"),
    ).toBeInTheDocument();
    expect(
      await within(step("Committee invited")).findByLabelText("Done"),
    ).toBeInTheDocument();
    expect(
      within(step("Sponsors linked")).getByLabelText("Not yet"),
    ).toBeInTheDocument();
    expect(
      within(step("Event published")).getByLabelText("Not yet"),
    ).toBeInTheDocument();
  });

  it("says so when the account may not see sponsors, without hiding the rest", async () => {
    renderOverview();
    expect(
      await screen.findByText("Not available for your account"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("1 race · 1 time trial"),
    ).toBeInTheDocument();
  });

  it("offers Publish for a draft event the account may publish", async () => {
    renderOverview();
    expect(
      await screen.findByRole("button", { name: "Publish event" }),
    ).toBeInTheDocument();
  });
});
