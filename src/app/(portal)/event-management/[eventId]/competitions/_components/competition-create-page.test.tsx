import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCompetition } from "@/domains/competitions/api";
import { CompetitionCreatePage } from "./competition-create-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/domains/events/api", () => ({
  getEvent: vi.fn().mockResolvedValue({ id: "e1", name: "Paw Race" }),
}));
vi.mock("@/domains/competitions/api", () => ({
  CompetitionSetupError: class extends Error {},
  createCompetition: vi.fn().mockResolvedValue({ id: "c9" }),
  listCompetitionTypes: vi.fn().mockResolvedValue([
    { id: "ct-race", code: "RACE", name: "Race", resultMode: "POSITION" },
    {
      id: "ct-beauty",
      code: "BEAUTY",
      name: "Beauty",
      resultMode: "JUDGED_SCORE",
    },
  ]),
  listSpecies: vi.fn().mockResolvedValue([]),
  listEventCompetitions: vi.fn().mockResolvedValue([]),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CompetitionCreatePage eventId="e1" />
    </QueryClientProvider>,
  );
}

async function fillBasics(
  user: ReturnType<typeof userEvent.setup>,
  type: string,
) {
  await user.type(screen.getByLabelText(/^Name/), "Best Costume");
  await user.click(await screen.findByText(type));
  await user.type(screen.getByLabelText(/^Starts/), "2026-09-04T10:00");
  await user.type(screen.getByLabelText(/^Ends/), "2026-09-04T12:00");
  // The "Online" channel is on by default; give it a window.
  const opens = screen.getAllByLabelText("Opens");
  const closes = screen.getAllByLabelText("Closes");
  await user.type(opens[1], "2026-08-01T00:00");
  await user.type(closes[1], "2026-08-30T00:00");
  await user.type(opens[2], "2026-08-01T00:00");
  await user.type(closes[2], "2026-09-04T09:00");
}

describe("CompetitionCreatePage", () => {
  beforeEach(() => vi.mocked(createCompetition).mockClear());

  it("only shows the criteria builder for judged types", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText("Race"));
    expect(screen.queryByText("Scoring criteria")).toBeNull();
    await user.click(screen.getByText("Beauty"));
    expect(screen.getByText("Scoring criteria")).toBeInTheDocument();
  });

  it("blocks saving until every criterion carries weight and they total 100", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillBasics(user, "Beauty");
    await user.type(screen.getByLabelText("Criterion"), "Appearance");
    await user.click(screen.getByRole("button", { name: /Add criterion/ }));
    await user.type(screen.getAllByLabelText("Criterion")[1], "Behavior");
    await user.click(
      screen.getByRole("button", { name: "Create competition" }),
    );
    expect(await screen.findByText("Must be above 0")).toBeInTheDocument();
    expect(createCompetition).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Split weights evenly" }),
    );
    expect(screen.getByText("Total weight 100%")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Create competition" }),
    );
    await waitFor(() => expect(createCompetition).toHaveBeenCalledTimes(1));
    const [, values] = vi.mocked(createCompetition).mock.calls[0];
    expect(values.criteria.map((c) => c.weight)).toEqual([50, 50]);
    expect(values.periods.filter((p) => p.enabled).map((p) => p.type)).toEqual([
      "ONLINE",
      "ON_SITE",
    ]);
  });
});
