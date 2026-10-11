import { describe, expect, it } from "vitest";
import { formatFinishTime, resultsCsvRows, timeLabel } from "./format";
import { fromApi, type ApiCompetitionResults } from "./types";

const api: ApiCompetitionResults = {
  competition_uuid: "c1",
  verification_status: "VERIFIED",
  verified_at: "2026-10-10T10:00:00+00:00",
  verified_by_uuid: "u1",
  verified_by_name: "Organizer Demo",
  // Sengaja tidak berurutan: mapper harus mengurutkan menurut rank.
  items: [
    {
      entry_uuid: "e2",
      rank: 2,
      pet_name: null,
      owner_name: "Citra Lestari",
      bib_number: null,
      finish_time_ms: 39087,
      status: "FINISHED",
    },
    {
      entry_uuid: "e1",
      rank: 1,
      pet_name: "Chibi",
      owner_name: "Alya Maulana",
      bib_number: "101",
      finish_time_ms: 38412,
      status: "FINISHED",
    },
    {
      entry_uuid: "e3",
      rank: 3,
      pet_name: "Nana",
      owner_name: "Damar Prakoso",
      bib_number: "013",
      finish_time_ms: null,
      status: "DNF",
    },
  ],
  actions: { verify: false },
};

describe("results fromApi", () => {
  it("maps camelCase fields, orders by rank and fills blanks", () => {
    const results = fromApi(api);
    expect(results.verified).toBe(true);
    expect(results.verifiedByName).toBe("Organizer Demo");
    expect(results.actions).toEqual({ verify: false });
    expect(results.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(results.rows[0]).toEqual({
      entryId: "e1",
      rank: 1,
      petName: "Chibi",
      ownerName: "Alya Maulana",
      bibNumber: "101",
      finishTimeMs: 38412,
      status: "FINISHED",
    });
    expect(results.rows[1].petName).toBe("Unnamed pet");
    expect(results.rows[1].bibNumber).toBe("");
  });

  it("reads PENDING as not verified", () => {
    const results = fromApi({
      ...api,
      verification_status: "PENDING",
      verified_at: null,
      verified_by_uuid: null,
      verified_by_name: null,
      actions: { verify: true },
    });
    expect(results.verified).toBe(false);
    expect(results.actions.verify).toBe(true);
  });
});

describe("formatFinishTime", () => {
  it("formats milliseconds as MM:SS.mmm", () => {
    expect(formatFinishTime(38412)).toBe("00:38.412");
    expect(formatFinishTime(0)).toBe("00:00.000");
    expect(formatFinishTime(61005)).toBe("01:01.005");
  });
  it("adds hours past one hour", () => {
    expect(formatFinishTime(3_723_450)).toBe("1:02:03.450");
  });
  it("returns a dash for missing or invalid values", () => {
    expect(formatFinishTime(null)).toBe("-");
    expect(formatFinishTime(-5)).toBe("-");
    expect(formatFinishTime(Number.NaN)).toBe("-");
  });
});

describe("timeLabel and CSV rows", () => {
  const rows = fromApi(api).rows;
  it("shows the time for finishers and the status text otherwise", () => {
    expect(timeLabel(rows[0])).toBe("00:38.412");
    expect(timeLabel(rows[2])).toBe("DNF");
    expect(timeLabel({ status: "DQ", finishTimeMs: null })).toBe("DQ");
    expect(timeLabel({ status: "DNS", finishTimeMs: null })).toBe("DNS");
  });
  it("builds one CSV row per participant with the same time column", () => {
    expect(resultsCsvRows(rows)[2]).toEqual({
      Rank: 3,
      Pet: "Nana",
      Bib: "013",
      Owner: "Damar Prakoso",
      Time: "DNF",
      Status: "DNF",
    });
    expect(resultsCsvRows(rows)).toHaveLength(3);
  });
});
