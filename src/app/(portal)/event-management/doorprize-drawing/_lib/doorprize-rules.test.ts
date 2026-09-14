import { describe, it, expect } from "vitest";
import { eligibleForDraw, hasPendingWinner, pickRandom } from "./doorprize-rules";

describe("eligibleForDraw", () => {
  const registrations = [
    { id: "REG-1", name: "REG-1", eventId: "EVT-1", paymentStatus: "Paid", doorprizeStatus: "" },
    { id: "REG-2", name: "REG-2", eventId: "EVT-1", paymentStatus: "Pending", doorprizeStatus: "" },
    { id: "REG-3", name: "REG-3", eventId: "EVT-1", paymentStatus: "Paid", doorprizeStatus: "Claimed" },
    { id: "REG-4", name: "REG-4", eventId: "EVT-2", paymentStatus: "Paid", doorprizeStatus: "" },
  ];
  it("only includes Paid registrations for the event that have not been drawn", () => {
    expect(eligibleForDraw(registrations, "EVT-1").map((row) => row.id)).toEqual(["REG-1"]);
  });
});

describe("hasPendingWinner", () => {
  it("detects an unresolved Waiting draw for the event", () => {
    const registrations = [
      { id: "REG-1", name: "REG-1", eventId: "EVT-1", doorprizeStatus: "Waiting" },
    ];
    expect(hasPendingWinner(registrations, "EVT-1")).toBe(true);
    expect(hasPendingWinner(registrations, "EVT-2")).toBe(false);
    expect(hasPendingWinner([{ ...registrations[0], doorprizeStatus: "Claimed" }], "EVT-1")).toBe(false);
  });
});

describe("pickRandom", () => {
  it("returns undefined for an empty list", () => {
    expect(pickRandom([])).toBeUndefined();
  });
  it("returns an item from the list", () => {
    const items = ["a", "b", "c"];
    expect(items).toContain(pickRandom(items));
  });
});
