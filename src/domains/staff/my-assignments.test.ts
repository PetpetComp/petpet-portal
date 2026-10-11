import { describe, expect, it } from "vitest";
import { eventFixture } from "@/test/event-fixtures";
import { competitionFixture } from "@/test/fixtures";
import { buildAssignmentGroups, distinctRoles } from "./my-assignments";

const event = eventFixture({ id: "e1", name: "Surabaya Paw Race 2026" });
const early = competitionFixture({
  id: "c1",
  eventId: "e1",
  name: "Paw Sprint 100M",
  startAt: "2026-09-04T08:00:00+07:00",
});
const late = competitionFixture({
  id: "c2",
  eventId: "e1",
  name: "Paw Relay",
  startAt: "2026-09-04T13:00:00+07:00",
});
const draft = competitionFixture({
  id: "c3",
  eventId: "e1",
  name: "Hidden draft",
  status: "DRAFT",
});
const competitions = { e1: [late, early, draft] };

describe("buildAssignmentGroups", () => {
  it("makes one card for a competition assignment", () => {
    const groups = buildAssignmentGroups(
      [{ eventId: "e1", competitionId: "c1", role: "COMPETITION_PIC" }],
      [event],
      competitions,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].cards.map((c) => c.competition.name)).toEqual([
      "Paw Sprint 100M",
    ]);
    expect(groups[0].cards[0].role).toBe("COMPETITION_PIC");
  });
  it("expands an event-level assignment to every runnable competition, in time order", () => {
    const groups = buildAssignmentGroups(
      [{ eventId: "e1", competitionId: null, role: "EVENT_MANAGER" }],
      [event],
      competitions,
    );
    expect(groups[0].cards.map((c) => c.competition.id)).toEqual(["c1", "c2"]);
  });
  it("drops assignments of events that are not today", () => {
    expect(
      buildAssignmentGroups(
        [{ eventId: "other", competitionId: "x", role: "JUDGE" }],
        [event],
        competitions,
      ),
    ).toEqual([]);
  });
  it("keeps two roles on one competition as two cards and collapses exact duplicates", () => {
    const groups = buildAssignmentGroups(
      [
        { eventId: "e1", competitionId: "c1", role: "JUDGE" },
        { eventId: "e1", competitionId: "c1", role: "HEAD_JUDGE" },
        { eventId: "e1", competitionId: "c1", role: "JUDGE" },
      ],
      [event],
      competitions,
    );
    expect(groups[0].cards).toHaveLength(2);
    expect(distinctRoles(groups)).toEqual(["JUDGE", "HEAD_JUDGE"]);
  });
});
