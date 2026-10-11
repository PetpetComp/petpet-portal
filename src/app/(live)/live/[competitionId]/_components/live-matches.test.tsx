import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMatches } from "@/domains/matches/api";
import type { MatchList, MatchSummary } from "@/domains/matches/types";
import { ApiError } from "@/lib/api-client";
import { LiveMatches } from "./live-matches";

const state = vi.hoisted(() => ({ typeId: "race" }));

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
vi.mock("@/domains/matches/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/matches/api")>()),
  getMatches: vi.fn(),
}));

/** Satu match ringkas: `pets` nama hewan, lane diberi nomor urut. */
function summary(
  number: number,
  status: MatchSummary["status"],
  pets: string[],
): MatchSummary {
  return {
    id: `h${number}`,
    number,
    status,
    heatStatus:
      status === "DONE"
        ? "COMPLETED"
        : status === "RUNNING"
          ? "IN_PROGRESS"
          : "SCHEDULED",
    plannedLanes: pets.map((name, index) => ({
      laneNumber: index + 1,
      entryId: `e${number}-${index + 1}`,
      petName: name,
      ownerName: `Owner of ${name}`,
      bibNumber: `0${number}${index + 1}`,
    })),
    currentSession: null,
    sessionCount: 0,
  };
}

/** Daftar dengan `doneCount` dan `nextMatchId` dihitung seperti `listFromApi`. */
function list(items: MatchSummary[], locked = true): MatchList {
  return {
    competitionId: "c1",
    drawingLocked: locked,
    items,
    doneCount: items.filter((m) => m.status === "DONE").length,
    nextMatchId: items.find((m) => m.status !== "DONE")?.id ?? null,
  };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LiveMatches competitionId="c1" />
    </QueryClientProvider>,
  );
}

const card = (n: number) => screen.getByRole("region", { name: `Match ${n}` });

beforeEach(() => {
  state.typeId = "race";
  vi.mocked(getMatches).mockReset();
});

describe("LiveMatches", () => {
  it("shows the summary and one card per match with status and pets", async () => {
    vi.mocked(getMatches).mockResolvedValue(
      list([
        summary(1, "DONE", ["Mika", "Niko"]),
        summary(2, "NOT_STARTED", ["Kona", "Coco", "Gizmo"]),
        summary(3, "NOT_STARTED", ["Chibi"]),
      ]),
    );
    renderScreen();
    expect(await screen.findByText("1 of 3 matches done")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Matches done" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(within(card(1)).getByText("Done")).toBeInTheDocument();
    expect(within(card(2)).getByText("Not started")).toBeInTheDocument();
    expect(within(card(2)).getByText("3 pets")).toBeInTheDocument();
    expect(within(card(2)).getByText("Gizmo")).toBeInTheDocument();
    expect(within(card(3)).getByText("1 pet")).toBeInTheDocument();
  });

  it("highlights the next match with a primary Run match link, others differ", async () => {
    vi.mocked(getMatches).mockResolvedValue(
      list([
        summary(1, "DONE", ["Mika"]),
        summary(2, "NOT_STARTED", ["Kona"]),
        summary(3, "NOT_STARTED", ["Chibi"]),
      ]),
    );
    renderScreen();
    await screen.findByText("1 of 3 matches done");
    expect(card(2)).toHaveAttribute("data-next", "true");
    expect(within(card(2)).getByText("Next")).toBeInTheDocument();
    expect(card(1)).not.toHaveAttribute("data-next");
    expect(card(3)).not.toHaveAttribute("data-next");
    expect(
      within(card(2)).getByRole("link", { name: /Run match/ }),
    ).toHaveAttribute("href", "/live/c1/matches/h2");
    expect(
      within(card(1)).getByRole("link", { name: /View result/ }),
    ).toHaveAttribute("href", "/live/c1/matches/h1");
  });

  it("offers Resume for a running match", async () => {
    vi.mocked(getMatches).mockResolvedValue(
      list([
        summary(1, "RUNNING", ["Mika"]),
        summary(2, "NOT_STARTED", ["Kona"]),
      ]),
    );
    renderScreen();
    await screen.findByText("0 of 2 matches done");
    expect(within(card(1)).getByText("Running")).toBeInTheDocument();
    expect(
      within(card(1)).getByRole("link", { name: /Resume/ }),
    ).toBeInTheDocument();
    expect(card(1)).toHaveAttribute("data-next", "true");
  });

  it("links to the Results tab when every match is done", async () => {
    vi.mocked(getMatches).mockResolvedValue(
      list([summary(1, "DONE", ["Mika"]), summary(2, "DONE", ["Kona"])]),
    );
    renderScreen();
    expect(await screen.findByText("2 of 2 matches done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View results/ })).toHaveAttribute(
      "href",
      "/live/c1/results",
    );
    expect(document.querySelector("[data-next]")).toBeNull();
  });

  it("shows an empty state with a link to Drawing when not drawn yet", async () => {
    vi.mocked(getMatches).mockResolvedValue(list([], false));
    renderScreen();
    expect(
      await screen.findByText(/The drawing is not locked yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Drawing" })).toHaveAttribute(
      "href",
      "/live/c1/drawing",
    );
  });

  it("shows the no-access page on 403", async () => {
    vi.mocked(getMatches).mockRejectedValue(new ApiError(403, "No"));
    renderScreen();
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });

  it("shows an error with Try again that refetches", async () => {
    vi.mocked(getMatches).mockRejectedValueOnce(new Error("Boom"));
    vi.mocked(getMatches).mockResolvedValue(
      list([summary(1, "NOT_STARTED", ["Mika"])]),
    );
    renderScreen();
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("0 of 1 matches done")).toBeInTheDocument();
  });

  it("explains that other competition types have no matches and does not call the API", async () => {
    state.typeId = "other";
    renderScreen();
    expect(
      await screen.findByText(/only available for Race competitions/),
    ).toBeInTheDocument();
    expect(getMatches).not.toHaveBeenCalled();
  });
});
