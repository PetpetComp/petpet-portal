import { describe, expect, it } from "vitest";
import { committeeCount, competitionMeta, progressSteps } from "./overview";
import type { CompetitionRule } from "./types";

const rule = {
  laneTotal: 5,
  timeLimitMs: 90000,
} as CompetitionRule;

describe("competitionMeta", () => {
  it("lists animal, participants, lanes and cut-off like the design", () => {
    expect(
      competitionMeta({ speciesLabel: "Sugar Glider", participants: 45, rule }),
    ).toEqual(["Sugar Glider", "45 participants", "5 lanes", "Cut-off 01:30"]);
  });
  it("leaves out lanes and cut-off when there is no rule", () => {
    expect(
      competitionMeta({
        speciesLabel: "Any animal",
        participants: 1,
        rule: null,
      }),
    ).toEqual(["Any animal", "1 participant"]);
  });
  it("leaves out what could not be loaded", () => {
    expect(
      competitionMeta({
        speciesLabel: null,
        participants: null,
        rule: { ...rule, laneTotal: 1, timeLimitMs: null } as CompetitionRule,
      }),
    ).toEqual(["1 lane"]);
  });
});

describe("committeeCount", () => {
  it("counts only the people assigned to this competition, not the event team", () => {
    const members = [
      { competitionId: null },
      { competitionId: "c1" },
      { competitionId: "c1" },
      { competitionId: "c2" },
    ];
    expect(committeeCount(members, "c1")).toBe(2);
    expect(committeeCount(members, "c9")).toBe(0);
  });
});

describe("progressSteps", () => {
  const open = {
    status: "SCHEDULED" as const,
    registrationClosed: false,
    registrationOpen: true,
    registrationClosedReason: null,
  };

  it("has the five steps of the design", () => {
    expect(progressSteps(open, null).map((s) => s.label)).toEqual([
      "Registration",
      "Check-in",
      "Drawing",
      "Matches",
      "Results",
    ]);
  });

  it("reads registration from the backend flags", () => {
    expect(progressSteps(open, null)[0]).toMatchObject({
      note: "Open",
      state: "active",
    });
    expect(
      progressSteps(
        {
          ...open,
          registrationOpen: false,
          registrationClosed: true,
          registrationClosedReason: "CLOSED_BY_ORGANIZER",
        },
        null,
      )[0],
    ).toMatchObject({ note: "Closed", state: "done", percent: 100 });
    expect(
      progressSteps(
        {
          ...open,
          registrationOpen: false,
          registrationClosedReason: "FULL",
        },
        null,
      )[0],
    ).toMatchObject({ note: "Full", state: "idle" });
  });

  it("shows check-in as a share of the entries", () => {
    expect(progressSteps(open, { total: 45, checkedIn: 45 })[1]).toMatchObject({
      note: "45 of 45",
      state: "done",
      percent: 100,
    });
    expect(progressSteps(open, { total: 40, checkedIn: 10 })[1]).toMatchObject({
      state: "active",
      percent: 25,
    });
    expect(progressSteps(open, { total: 0, checkedIn: 0 })[1]).toMatchObject({
      state: "idle",
      percent: 0,
    });
    expect(progressSteps(open, null)[1].note).toBe("Not available");
  });

  it("derives drawing, matches and results from the status only", () => {
    const ongoing = progressSteps({ ...open, status: "ONGOING" }, null);
    expect(ongoing[2].state).toBe("done");
    expect(ongoing[3]).toMatchObject({ state: "active", note: "In progress" });
    expect(ongoing[4].state).toBe("idle");
    const done = progressSteps({ ...open, status: "COMPLETED" }, null);
    expect(done[3].state).toBe("done");
    expect(done[4]).toMatchObject({ state: "done", note: "Final" });
    expect(progressSteps(open, null)[2].note).toBe("Not drawn yet");
  });
});
