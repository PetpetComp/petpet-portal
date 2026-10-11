import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveEntry } from "./live-entry";
import { liveVariantOf } from "./live-family";

const state = vi.hoisted(() => ({ typeId: "race", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
}));
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
        id: "beauty",
        code: "BEAUTY",
        name: "Beauty",
        resultMode: "JUDGED_SCORE",
      },
      {
        id: "bis",
        code: "BEST_IN_SHOW",
        name: "Best in Show",
        resultMode: "COMBINED",
      },
    ]),
  };
});

function renderEntry() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LiveEntry competitionId="c1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => state.replace.mockClear());

describe("liveVariantOf", () => {
  it("separates Race, Time trial and Contest by type code", () => {
    expect(liveVariantOf("RACE")).toBe("race");
    expect(liveVariantOf("TIME_TRIAL")).toBe("timetrial");
    expect(liveVariantOf("BEAUTY")).toBe("contest");
    expect(liveVariantOf("BEST_IN_SHOW")).toBe("contest");
    expect(liveVariantOf(undefined)).toBe("race");
  });
});

describe("LiveEntry", () => {
  it.each([
    ["race", "/live/c1/drawing"],
    ["tt", "/live/c1/drawing"],
    ["beauty", "/live/c1/judging"],
    ["bis", "/live/c1/judging"],
  ])("sends type %s to %s", async (typeId, target) => {
    state.typeId = typeId;
    renderEntry();
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith(target));
  });
});
