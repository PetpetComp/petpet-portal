import { describe, expect, it } from "vitest";
import type { ScoreMap } from "@/domains/judging/types";
import { buildChanges, clearSaved, hasSavable, mergeScores } from "./autosave";

const server: ScoreMap = {
  a: { score: 5, note: "" },
  b: { score: 6, note: "old" },
};

describe("mergeScores", () => {
  it("lays local edits over the server values", () => {
    const merged = mergeScores(server, {
      criteria: { a: { score: 8 }, c: { note: "only note" } },
    });
    expect(merged.a).toEqual({ score: 8, note: "" });
    expect(merged.b).toEqual({ score: 6, note: "old" });
    expect(merged.c).toEqual({ score: null, note: "only note" });
  });
});

describe("buildChanges", () => {
  it("sends only changed criteria and skips notes that have no score yet", () => {
    const changes = buildChanges(server, {
      criteria: { a: { score: 8 }, b: { note: "new" }, c: { note: "x" } },
    });
    expect(changes).toEqual([
      { criterionId: "a", score: 8 },
      { criterionId: "b", score: 6, note: "new" },
    ]);
  });

  it("reports whether anything can be saved", () => {
    expect(hasSavable(server, undefined)).toBe(false);
    expect(hasSavable(server, { criteria: { c: { note: "x" } } })).toBe(false);
    expect(hasSavable(server, { criteria: {}, judgeNote: "hi" })).toBe(true);
  });
});

describe("clearSaved", () => {
  it("drops what was sent but keeps edits made while saving", () => {
    const left = clearSaved(
      { criteria: { a: { score: 9 }, b: { score: 4, note: "n" } } },
      [
        { criterionId: "a", score: 8 },
        { criterionId: "b", score: 4, note: "n" },
      ],
      undefined,
    );
    expect(left).toEqual({ criteria: { a: { score: 9 } } });
  });

  it("returns undefined when everything was saved", () => {
    expect(
      clearSaved(
        { criteria: { a: { score: 8 } }, judgeNote: "ok" },
        [{ criterionId: "a", score: 8 }],
        "ok",
      ),
    ).toBeUndefined();
  });
});
