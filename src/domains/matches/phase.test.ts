import { describe, expect, it } from "vitest";
import {
  effectiveMatchActions,
  laneActionAllowed,
  MATCH_PHASES,
  PHASE_ALLOWANCE,
  phaseOf,
} from "./phase";
import type { MatchActions } from "./types";

const all: MatchActions = {
  createSession: true,
  start: true,
  finish: true,
  stop: true,
  rematch: true,
  markDns: true,
  disqualify: true,
  confirm: true,
};

describe("phaseOf", () => {
  it("is IDLE without a usable session", () => {
    expect(phaseOf("SCHEDULED", null, false)).toBe("IDLE");
    expect(phaseOf("IN_PROGRESS", "CANCELLED", false)).toBe("IDLE");
    expect(phaseOf("IN_PROGRESS", "REMATCHED", false)).toBe("IDLE");
  });
  it("follows the session status", () => {
    expect(phaseOf("SCHEDULED", "READY", false)).toBe("READY");
    expect(phaseOf("IN_PROGRESS", "RUNNING", false)).toBe("RUNNING");
    expect(phaseOf("IN_PROGRESS", "FINISHED", false)).toBe("STOPPED");
    expect(phaseOf("IN_PROGRESS", "CUTOFF", false)).toBe("STOPPED");
  });
  it("shows COUNTDOWN while the screen counts down a READY session, or when the server says so", () => {
    expect(phaseOf("SCHEDULED", "READY", true)).toBe("COUNTDOWN");
    expect(phaseOf("SCHEDULED", "COUNTDOWN", false)).toBe("COUNTDOWN");
  });
  it("is DONE once the heat is completed, whatever the session says", () => {
    expect(phaseOf("COMPLETED", "FINISHED", false)).toBe("DONE");
    expect(phaseOf("COMPLETED", null, true)).toBe("DONE");
  });
});

describe("PHASE_ALLOWANCE", () => {
  const phasesWith = (key: keyof (typeof PHASE_ALLOWANCE)["IDLE"]) =>
    MATCH_PHASES.filter((p) => PHASE_ALLOWANCE[p][key]);

  it("allows Start only when READY and Finish and Stop only while RUNNING", () => {
    expect(phasesWith("start")).toEqual(["READY"]);
    expect(phasesWith("finish")).toEqual(["RUNNING"]);
    expect(phasesWith("stop")).toEqual(["RUNNING"]);
  });
  it("allows Confirm only after the session stopped", () => {
    expect(phasesWith("confirm")).toEqual(["STOPPED"]);
  });
  it("allows Rematch and undo while running or stopped, never before or after", () => {
    expect(phasesWith("rematch")).toEqual(["RUNNING", "STOPPED"]);
    expect(phasesWith("undoFinish")).toEqual(["RUNNING", "STOPPED"]);
  });
  it("allows nothing during the countdown or once done", () => {
    for (const phase of ["COUNTDOWN", "DONE"] as const)
      expect(Object.values(PHASE_ALLOWANCE[phase]).some(Boolean)).toBe(false);
  });
  it("only creates a session when IDLE, and disqualifies only once started", () => {
    expect(phasesWith("createSession")).toEqual(["IDLE"]);
    expect(phasesWith("disqualify")).toEqual(["RUNNING", "STOPPED"]);
  });
});

describe("effectiveMatchActions", () => {
  it("never grants what the server did not", () => {
    const none = Object.fromEntries(
      Object.keys(all).map((k) => [k, false]),
    ) as MatchActions;
    for (const phase of MATCH_PHASES)
      expect(
        Object.values(effectiveMatchActions(none, phase)).some(Boolean),
      ).toBe(false);
  });
  it("narrows the server flags to the phase", () => {
    expect(effectiveMatchActions(all, "RUNNING")).toMatchObject({
      start: false,
      finish: true,
      stop: true,
      confirm: false,
    });
    expect(effectiveMatchActions(all, "COUNTDOWN").finish).toBe(false);
    expect(effectiveMatchActions({ ...all, start: false }, "READY").start).toBe(
      false,
    );
  });
});

describe("laneActionAllowed", () => {
  it("lets a lane finish only while running", () => {
    expect(laneActionAllowed("RUNNING", "finish")).toBe(true);
    expect(laneActionAllowed("STOPPED", "finish")).toBe(false);
    expect(laneActionAllowed("COUNTDOWN", "finish")).toBe(false);
    expect(laneActionAllowed("STOPPED", "undoFinish")).toBe(true);
    expect(laneActionAllowed("DONE", "markDns")).toBe(false);
  });
});
