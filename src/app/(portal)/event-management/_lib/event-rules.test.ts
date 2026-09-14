import { describe, it, expect } from "vitest";
import {
  isDuplicateEventName,
  isValidDateRange,
  eventInitials,
  hasLinkedRecords,
  isEligibleEvent,
} from "./event-rules";

describe("isDuplicateEventName", () => {
  const events = [{ id: "EVT-1", name: "Jakarta Pet Festival" }];
  it("flags a reused name on another event", () => {
    expect(
      isDuplicateEventName(events, { id: "EVT-2", name: "jakarta pet festival" }),
    ).toBe(true);
  });
  it("ignores the record being edited", () => {
    expect(
      isDuplicateEventName(events, { id: "EVT-1", name: "Jakarta Pet Festival" }),
    ).toBe(false);
  });
});

describe("isValidDateRange", () => {
  it("requires the end date to be after the start date", () => {
    expect(isValidDateRange("2026-01-01T10:00", "2026-01-02T10:00")).toBe(true);
    expect(isValidDateRange("2026-01-02T10:00", "2026-01-01T10:00")).toBe(false);
    expect(isValidDateRange("", "")).toBe(true);
  });
});

describe("eventInitials", () => {
  it("builds initials from the first two words", () => {
    expect(eventInitials("Jakarta Pet Festival")).toBe("JP");
    expect(eventInitials("")).toBe("EV");
  });
});

describe("isEligibleEvent", () => {
  it("allows Open and Pending events only", () => {
    expect(isEligibleEvent({ id: "E", name: "E", status: "Open" })).toBe(true);
    expect(isEligibleEvent({ id: "E", name: "E", status: "Pending" })).toBe(true);
    expect(isEligibleEvent({ id: "E", name: "E", status: "Closed" })).toBe(false);
  });
});

describe("hasLinkedRecords", () => {
  it("detects any related record across collections", () => {
    const empty = { competitions: [], registrations: [], committee: [], partners: [], prizes: [] };
    expect(hasLinkedRecords(empty, "EVT-1")).toBe(false);
    expect(
      hasLinkedRecords(
        { ...empty, competitions: [{ id: "C", name: "C", eventId: "EVT-1" }] },
        "EVT-1",
      ),
    ).toBe(true);
  });
});
