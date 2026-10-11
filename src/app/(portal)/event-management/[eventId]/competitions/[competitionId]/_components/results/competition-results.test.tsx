import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompetitionResults, ResultRow } from "@/domains/results/types";
import { CompetitionResults as ResultsTab } from "./competition-results";

const state = vi.hoisted(() => ({ typeId: "race", empty: false }));

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
vi.mock("@/domains/results/api", () => {
  const row = (
    rank: number,
    petName: string,
    over: Partial<ResultRow> = {},
  ): ResultRow => ({
    entryId: `e${rank}`,
    rank,
    petName,
    ownerName: `Owner ${rank}`,
    bibNumber: "",
    finishTimeMs: 38000 + rank * 1000,
    status: "FINISHED",
    ...over,
  });
  const make = (): CompetitionResults => ({
    competitionId: "c1",
    verified: false,
    verifiedAt: null,
    verifiedByName: null,
    rows: state.empty
      ? []
      : [
          row(1, "Chibi"),
          row(2, "Sora"),
          row(3, "Kona"),
          row(4, "Niko"),
          row(5, "Nana", { status: "DNF", finishTimeMs: null }),
        ],
    actions: { verify: true },
  });
  return {
    getCompetitionResults: vi.fn(async () => make()),
    verifyCompetitionResults: vi.fn(async () => make()),
  };
});

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ResultsTab competitionId="c1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.typeId = "race";
  state.empty = false;
});

describe("CompetitionResults (Race)", () => {
  it("shows the mock banner, the podium in rank order and the table from rank 4", async () => {
    renderTab();
    expect(
      await screen.findByText(
        "Mock data - the results API is not built yet. Layout follows the agreed contract.",
      ),
    ).toBeInTheDocument();

    const podium = screen.getByRole("list", { name: "Podium" });
    const places = within(podium).getAllByRole("listitem");
    expect(places.map((p) => p.getAttribute("data-place"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(within(places[0]).getByText("Chibi")).toBeInTheDocument();
    expect(within(places[0]).getByText("00:39.000")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Niko")).toBeInTheDocument();
    expect(within(table).queryByText("Chibi")).not.toBeInTheDocument();
    // DNF tampil sebagai teks di kolom waktu.
    expect(within(table).getByText("DNF")).toBeInTheDocument();
  });

  it("shows Verify results only when the API allows it", async () => {
    renderTab();
    expect(
      await screen.findByRole("button", { name: "Verify results" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no results yet", async () => {
    state.empty = true;
    renderTab();
    expect(await screen.findByText(/No results yet/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("CompetitionResults (other types)", () => {
  it("shows the not-available message and no banner or podium", async () => {
    state.typeId = "tt";
    renderTab();
    expect(
      await screen.findByText("Results for this type are not available yet"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mock data/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Podium" }),
    ).not.toBeInTheDocument();
  });
});
