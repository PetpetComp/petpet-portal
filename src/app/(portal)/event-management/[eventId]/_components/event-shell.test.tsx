import { describe, expect, it } from "vitest";
import { eventTabs } from "./event-shell";

describe("eventTabs", () => {
  const tabs = eventTabs("e1", {
    competitions: 9,
    participants: null,
    sponsors: 8,
  });

  it("has the seven tabs of the design, in order", () => {
    expect(tabs.map((t) => t.label)).toEqual([
      "Overview",
      "Competitions",
      "Registrations",
      "Participants & check-in",
      "Committee",
      "Sponsors",
      "Doorprize",
    ]);
  });

  it("points every tab inside the event", () => {
    expect(tabs.map((t) => t.href)).toEqual([
      "/event-management/e1",
      "/event-management/e1/competitions",
      "/event-management/e1/registrations",
      "/event-management/e1/participants",
      "/event-management/e1/committee",
      "/event-management/e1/sponsors",
      "/event-management/e1/doorprize",
    ]);
    expect(tabs[0].exact).toBe(true);
  });

  it("carries the counts, leaving out the ones that could not be loaded", () => {
    expect(tabs.find((t) => t.label === "Competitions")?.count).toBe(9);
    expect(tabs.find((t) => t.label === "Sponsors")?.count).toBe(8);
    expect(
      tabs.find((t) => t.label === "Participants & check-in")?.count,
    ).toBeNull();
  });
});
