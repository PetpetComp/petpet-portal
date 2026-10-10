import { describe, expect, it } from "vitest";
import { eventsByDay, relevantEvents } from "./schedule";
import type { Event } from "./types";

const ev = (id: string, startAt: string, endAt = startAt): Event => ({
  id,
  code: "",
  organizationId: "o1",
  organizationName: "",
  name: id,
  tagline: "",
  description: "",
  venueName: "",
  venueAddress: "",
  mapLocation: "",
  timezone: "Asia/Jakarta",
  startAt,
  endAt,
  status: "PUBLISHED",
  phase: null,
});
const now = new Date(2026, 8, 4, 12, 0); // 4 Sep 2026, noon local time
const at = (d: number, h: number) => new Date(2026, 8, d, h).toISOString();

describe("eventsByDay", () => {
  it("finds events running today, including multi-day ones that started earlier", () => {
    const result = eventsByDay(
      [
        ev("today", at(4, 10), at(4, 20)),
        ev("multi", at(3, 9), at(5, 18)),
        ev("past", at(1, 9), at(1, 18)),
      ],
      now,
    );
    expect(result.today.map((e) => e.id)).toEqual(["today", "multi"]);
  });
  it("lists the next events soonest first, without past ones", () => {
    const result = eventsByDay(
      [
        ev("later", at(20, 9)),
        ev("soon", at(5, 9)),
        ev("past", at(1, 9)),
        ev("mid", at(10, 9)),
      ],
      now,
      2,
    );
    expect(result.upcoming.map((e) => e.id)).toEqual(["soon", "mid"]);
  });
  it("ignores events without a valid start", () => {
    expect(eventsByDay([ev("bad", "")], now)).toEqual({
      today: [],
      upcoming: [],
    });
  });
});

describe("relevantEvents", () => {
  const mine = { ...ev("mine", at(5, 9)), organizationId: "o1" };
  const other = { ...ev("other", at(5, 9)), organizationId: "o2" };
  const assigned = { ...ev("assigned", at(6, 9)), organizationId: "o3" };
  const all = [mine, other, assigned];
  it("keeps my organizations' events and the ones I am assigned to", () => {
    const result = relevantEvents(all, {
      isAdmin: false,
      organizationIds: ["o1"],
      assignedEventIds: ["assigned"],
    });
    expect(result.map((e) => e.id)).toEqual(["mine", "assigned"]);
  });
  it("shows everything to a platform admin", () => {
    const result = relevantEvents(all, {
      isAdmin: true,
      organizationIds: [],
      assignedEventIds: [],
    });
    expect(result).toHaveLength(3);
  });
});
