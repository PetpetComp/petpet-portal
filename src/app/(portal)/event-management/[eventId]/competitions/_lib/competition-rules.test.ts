import { describe, it, expect } from "vitest";
import {
  typeConfigFields,
  isDuplicateCompetitionName,
  isValidChannelWindow,
  canCloseRegistration,
  parseContestCriteria,
  DEFAULT_CONTEST_CRITERIA,
  runPathFor,
} from "./competition-rules";

describe("typeConfigFields", () => {
  it("shows lanes for Race and Checkpoint Race", () => {
    expect(typeConfigFields("Race").lanes).toBe(true);
    expect(typeConfigFields("Checkpoint Race").lanes).toBe(true);
    expect(typeConfigFields("Contest").lanes).toBe(false);
  });
  it("shows checkpoints for Checkpoint Race and Checkpoint Time Trial", () => {
    expect(typeConfigFields("Checkpoint Race").checkpoints).toBe(true);
    expect(typeConfigFields("Checkpoint Time Trial").checkpoints).toBe(true);
    expect(typeConfigFields("Race").checkpoints).toBe(false);
  });
  it("shows cutoff for Time Trial and Checkpoint Time Trial", () => {
    expect(typeConfigFields("Time Trial").cutoff).toBe(true);
    expect(typeConfigFields("Checkpoint Time Trial").cutoff).toBe(true);
    expect(typeConfigFields("Race").cutoff).toBe(false);
  });
});

describe("runPathFor", () => {
  it("routes each competition type to its run page", () => {
    expect(runPathFor("Contest")).toBe("contest");
    expect(runPathFor("Time Trial")).toBe("time-trial");
    expect(runPathFor("Checkpoint Time Trial")).toBe("time-trial");
    expect(runPathFor("Race")).toBe("run-match");
    expect(runPathFor("Checkpoint Race")).toBe("run-match");
  });
});

describe("isDuplicateCompetitionName", () => {
  const competitions = [
    { id: "CMP-1", name: "Small Dog Sprint", eventId: "EVT-1" },
  ];
  it("flags a reused name within the same event", () => {
    expect(
      isDuplicateCompetitionName(competitions, {
        id: "CMP-2",
        name: "small dog sprint",
        eventId: "EVT-1",
      }),
    ).toBe(true);
  });
  it("allows the same name under a different event", () => {
    expect(
      isDuplicateCompetitionName(competitions, {
        id: "CMP-2",
        name: "Small Dog Sprint",
        eventId: "EVT-2",
      }),
    ).toBe(false);
  });
  it("ignores the record being edited", () => {
    expect(
      isDuplicateCompetitionName(competitions, {
        id: "CMP-1",
        name: "Small Dog Sprint",
        eventId: "EVT-1",
      }),
    ).toBe(false);
  });
});

describe("isValidChannelWindow", () => {
  it("requires close after open when both are set", () => {
    expect(isValidChannelWindow("2026-01-01T10:00", "2026-01-02T10:00")).toBe(true);
    expect(isValidChannelWindow("2026-01-02T10:00", "2026-01-01T10:00")).toBe(false);
    expect(isValidChannelWindow("", "")).toBe(true);
  });
});

describe("canCloseRegistration", () => {
  it("allows closing only while still open", () => {
    expect(canCloseRegistration("Open")).toBe(true);
    expect(canCloseRegistration(undefined)).toBe(true);
    expect(canCloseRegistration("Closed")).toBe(false);
  });
});

describe("parseContestCriteria", () => {
  it("falls back to defaults for missing or invalid JSON", () => {
    expect(parseContestCriteria(undefined)).toEqual(DEFAULT_CONTEST_CRITERIA);
    expect(parseContestCriteria("not-json")).toEqual(DEFAULT_CONTEST_CRITERIA);
    expect(parseContestCriteria("[]")).toEqual(DEFAULT_CONTEST_CRITERIA);
  });
  it("parses a valid criteria list", () => {
    const custom = [{ name: "Costume", maxPoints: 50 }];
    expect(parseContestCriteria(JSON.stringify(custom))).toEqual(custom);
  });
});
