import { describe, it, expect } from "vitest";
import {
  buildInitialBracket,
  parseBracket,
  isRoundComplete,
  qualifiersFrom,
  generateNextRound,
  canSwap,
  swapParticipants,
  type RaceMatch,
} from "./race-bracket";

describe("buildInitialBracket", () => {
  it("splits participants into lane-sized matches", () => {
    const bracket = buildInitialBracket(["P1", "P2", "P3", "P4", "P5"], 4);
    expect(bracket.rounds).toHaveLength(1);
    expect(bracket.rounds[0]).toHaveLength(2);
    expect(bracket.rounds[0][0].participantIds).toEqual(["P1", "P2", "P3", "P4"]);
    expect(bracket.rounds[0][1].participantIds).toEqual(["P5"]);
    expect(bracket.rounds[0][0].type).toBe("Qualification");
  });
  it("marks a single match as Final", () => {
    const bracket = buildInitialBracket(["P1", "P2"], 4);
    expect(bracket.rounds[0]).toHaveLength(1);
    expect(bracket.rounds[0][0].type).toBe("Final");
  });
});

describe("parseBracket", () => {
  it("builds a fresh bracket when JSON is missing or invalid", () => {
    expect(parseBracket(undefined, ["P1"], 4).rounds[0]).toHaveLength(1);
    expect(parseBracket("not-json", ["P1"], 4).rounds[0]).toHaveLength(1);
  });
  it("returns the parsed bracket when valid", () => {
    const bracket = buildInitialBracket(["P1", "P2"], 4);
    const json = JSON.stringify(bracket);
    expect(parseBracket(json, ["P1", "P2"], 4)).toEqual(bracket);
  });
});

describe("isRoundComplete", () => {
  it("requires every match in the round to be confirmed", () => {
    const round: RaceMatch[] = [
      { id: "R1M1", round: 1, match: 1, type: "Final", participantIds: [], results: {}, confirmed: true },
    ];
    expect(isRoundComplete(round)).toBe(true);
    expect(isRoundComplete([{ ...round[0], confirmed: false }])).toBe(false);
    expect(isRoundComplete([])).toBe(false);
  });
});

describe("qualifiersFrom", () => {
  const match: RaceMatch = {
    id: "R1M1",
    round: 1,
    match: 1,
    type: "Qualification",
    participantIds: ["P1", "P2", "P3", "P4"],
    results: {
      P1: { position: "2", time: 2000 },
      P2: { position: "1", time: 1000 },
      P3: { position: "DNS", time: null },
      P4: { position: "DSQ", time: null },
    },
    confirmed: true,
  };
  it("ranks by numeric position and excludes DNS/DSQ", () => {
    expect(qualifiersFrom(match, 2)).toEqual(["P2", "P1"]);
    expect(qualifiersFrom(match, 1)).toEqual(["P2"]);
  });
});

describe("generateNextRound", () => {
  it("advances qualifiers from every match into new lane-sized matches", () => {
    const round: RaceMatch[] = [
      {
        id: "R1M1",
        round: 1,
        match: 1,
        type: "Qualification",
        participantIds: ["P1", "P2"],
        results: { P1: { position: "1", time: 1000 }, P2: { position: "2", time: 2000 } },
        confirmed: true,
      },
      {
        id: "R1M2",
        round: 1,
        match: 2,
        type: "Qualification",
        participantIds: ["P3", "P4"],
        results: { P3: { position: "1", time: 1100 }, P4: { position: "2", time: 2100 } },
        confirmed: true,
      },
    ];
    const next = generateNextRound(round, 1, 4);
    expect(next).toHaveLength(1);
    expect(next[0].round).toBe(2);
    expect(next[0].type).toBe("Final");
    expect(next[0].participantIds).toEqual(["P1", "P3"]);
  });
});

describe("canSwap / swapParticipants", () => {
  const bracket = buildInitialBracket(["P1", "P2", "P3", "P4"], 2);
  it("allows swapping only participants without a recorded result", () => {
    expect(canSwap(bracket.rounds[0][0], "P1")).toBe(true);
    const withResult = {
      ...bracket.rounds[0][0],
      results: { P1: { position: "1", time: 1000 } },
    };
    expect(canSwap(withResult, "P1")).toBe(false);
  });
  it("swaps two participants across matches in the same round", () => {
    const next = swapParticipants(bracket, 0, "P1", "P3");
    expect(next.rounds[0][0].participantIds).toEqual(["P3", "P2"]);
    expect(next.rounds[0][1].participantIds).toEqual(["P1", "P4"]);
  });
});
