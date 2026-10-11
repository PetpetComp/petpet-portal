import { describe, expect, it } from "vitest";
import type { CompetitionDrawing } from "@/domains/drawing/types";
import { liveProgressLine } from "./live-progress";

const match = (number: number, status: "SCHEDULED" | "COMPLETED") => ({
  id: `m${number}`,
  number,
  status,
  lanes: [],
});
const drawing = (
  over: Partial<Pick<CompetitionDrawing, "locked" | "matches" | "lanes">>,
) => ({ locked: true, lanes: 5, matches: [], ...over });

describe("liveProgressLine", () => {
  it("shows the first unfinished match and the lanes for a locked race", () => {
    const matches = [match(1, "COMPLETED"), match(2, "SCHEDULED")];
    expect(
      liveProgressLine({
        status: "ONGOING",
        isRace: true,
        drawing: drawing({ matches }),
        laneTotal: null,
      }),
    ).toBe("Match 2 of 2 - 5 lanes");
  });
  it("says all matches are done when none is left", () => {
    expect(
      liveProgressLine({
        status: "ONGOING",
        isRace: true,
        drawing: drawing({ matches: [match(1, "COMPLETED")], lanes: 1 }),
        laneTotal: null,
      }),
    ).toBe("All 1 match done - 1 lane");
  });
  it("tells that the drawing is missing before lock", () => {
    expect(
      liveProgressLine({
        status: "SCHEDULED",
        isRace: true,
        drawing: drawing({ locked: false, lanes: 4 }),
        laneTotal: null,
      }),
    ).toBe("Drawing not done yet - 4 lanes");
  });
  it("falls back to the rule lanes when the drawing is unavailable", () => {
    expect(
      liveProgressLine({
        status: "ONGOING",
        isRace: true,
        drawing: null,
        laneTotal: 6,
      }),
    ).toBe("6 lanes");
  });
  it("falls back to the status label without any data, and for non-race types", () => {
    expect(
      liveProgressLine({
        status: "ONGOING",
        isRace: true,
        drawing: null,
        laneTotal: null,
      }),
    ).toBe("Live");
    expect(
      liveProgressLine({
        status: "SCHEDULED",
        isRace: false,
        drawing: null,
        laneTotal: 4,
      }),
    ).toBe("Upcoming");
  });
});
