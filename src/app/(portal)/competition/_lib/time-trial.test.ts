import { describe, it, expect } from "vitest";
import { parseAttempts, nextUnresolvedIndex, type Attempt } from "./time-trial";

describe("parseAttempts", () => {
  it("returns an empty object for missing or invalid JSON", () => {
    expect(parseAttempts(undefined)).toEqual({});
    expect(parseAttempts("not-json")).toEqual({});
  });
  it("parses valid JSON", () => {
    const data: Record<string, Attempt> = { "PET-1": { status: "finish", time: 5000 } };
    expect(parseAttempts(JSON.stringify(data))).toEqual(data);
  });
});

describe("nextUnresolvedIndex", () => {
  const order = ["P1", "P2", "P3"];
  it("finds the next participant without a recorded attempt", () => {
    expect(nextUnresolvedIndex(order, {}, 0)).toBe(0);
    expect(nextUnresolvedIndex(order, { P1: { status: "finish", time: 1 } }, 0)).toBe(1);
  });
  it("wraps around to find an earlier skipped participant", () => {
    expect(nextUnresolvedIndex(order, { P2: { status: "finish", time: 1 } }, 1)).toBe(2);
    expect(
      nextUnresolvedIndex(
        order,
        { P1: { status: "finish", time: 1 }, P3: { status: "finish", time: 1 } },
        2,
      ),
    ).toBe(1);
  });
  it("returns -1 when every participant is resolved", () => {
    const attempts: Record<string, Attempt> = {
      P1: { status: "finish", time: 1 },
      P2: { status: "finish", time: 1 },
      P3: { status: "finish", time: 1 },
    };
    expect(nextUnresolvedIndex(order, attempts, 0)).toBe(-1);
  });
});
