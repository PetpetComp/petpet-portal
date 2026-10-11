import { describe, expect, it } from "vitest";
import { lockBody } from "./api";
import { DRAWABLE_TYPE_CODES, isDrawableType, isQueueType } from "./constants";
import { fromApi, type ApiDrawing } from "./types";

const api: ApiDrawing = {
  competition_uuid: "c1",
  status: "LOCKED",
  lanes: 5,
  locked_at: "2026-10-11T07:00:00+00:00",
  locked_by_uuid: "u1",
  locked_by_name: "Organizer Demo",
  participants: [
    {
      entry_uuid: "e1",
      pet_name: "Chibi",
      owner_name: "Alya Maulana",
      bib_number: "001",
    },
    {
      entry_uuid: "e2",
      pet_name: null,
      owner_name: "Citra Lestari",
      bib_number: null,
    },
  ],
  // Sengaja tidak berurutan: mapper harus mengurutkan match dan lane.
  matches: [
    {
      uuid: "h2",
      match_number: 2,
      status: "IN_PROGRESS",
      lanes: [
        {
          lane_number: 1,
          entry_uuid: "e2",
          pet_name: null,
          owner_name: "Citra Lestari",
          bib_number: null,
        },
      ],
    },
    {
      uuid: "h1",
      match_number: 1,
      status: "SCHEDULED",
      lanes: [
        {
          lane_number: 2,
          entry_uuid: "e2",
          pet_name: null,
          owner_name: "Citra Lestari",
          bib_number: null,
        },
        {
          lane_number: 1,
          entry_uuid: "e1",
          pet_name: "Chibi",
          owner_name: "Alya Maulana",
          bib_number: "001",
        },
      ],
    },
  ],
  lock_blocked_reason: "ALREADY_LOCKED",
  actions: { lock: false, swap: true },
};

describe("drawing fromApi", () => {
  it("maps camelCase fields, orders matches and lanes and fills blanks", () => {
    const drawing = fromApi(api);
    expect(drawing.locked).toBe(true);
    expect(drawing.lanes).toBe(5);
    expect(drawing.lockedByName).toBe("Organizer Demo");
    expect(drawing.lockBlockedReason).toBe("ALREADY_LOCKED");
    expect(drawing.actions).toEqual({ lock: false, swap: true });
    expect(drawing.matches.map((m) => m.number)).toEqual([1, 2]);
    expect(drawing.matches[0]).toMatchObject({ id: "h1", status: "SCHEDULED" });
    expect(drawing.matches[0].lanes.map((l) => l.laneNumber)).toEqual([1, 2]);
    expect(drawing.matches[0].lanes[0]).toEqual({
      entryId: "e1",
      petName: "Chibi",
      ownerName: "Alya Maulana",
      bibNumber: "001",
      laneNumber: 1,
    });
    expect(drawing.participants[1].petName).toBe("Unnamed pet");
    expect(drawing.participants[1].bibNumber).toBe("");
  });

  it("reads NOT_DRAWN as not locked", () => {
    const drawing = fromApi({
      ...api,
      status: "NOT_DRAWN",
      locked_at: null,
      locked_by_uuid: null,
      locked_by_name: null,
      matches: [],
      lock_blocked_reason: null,
      actions: { lock: true, swap: false },
    });
    expect(drawing.locked).toBe(false);
    expect(drawing.matches).toEqual([]);
    expect(drawing.actions.lock).toBe(true);
  });
});

describe("lockBody", () => {
  it("numbers the lanes from 1 in the given order", () => {
    expect(lockBody([["a", "b"], ["c"]])).toEqual({
      matches: [
        {
          lanes: [
            { lane_number: 1, entry_uuid: "a" },
            { lane_number: 2, entry_uuid: "b" },
          ],
        },
        { lanes: [{ lane_number: 1, entry_uuid: "c" }] },
      ],
    });
  });
});

describe("drawable types", () => {
  it("allows Race and Time trial, refuses the rest", () => {
    expect(DRAWABLE_TYPE_CODES).toEqual(["RACE", "TIME_TRIAL"]);
    expect(isDrawableType("RACE")).toBe(true);
    expect(isDrawableType("TIME_TRIAL")).toBe(true);
    for (const code of ["BEAUTY", "CHECKPOINT", "", null, undefined])
      expect(isDrawableType(code)).toBe(false);
  });

  it("treats only Time trial as a single queue", () => {
    expect(isQueueType("TIME_TRIAL")).toBe(true);
    expect(isQueueType("RACE")).toBe(false);
    expect(isQueueType(null)).toBe(false);
  });
});
