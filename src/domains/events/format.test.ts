import { describe, expect, it } from "vitest";
import { formatEventSchedule } from "./format";

/** ISO dari komponen tanggal lokal, supaya tes tidak bergantung zona waktu mesin. */
const iso = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("formatEventSchedule", () => {
  it("formats a one-day event", () => {
    expect(
      formatEventSchedule(iso(2026, 9, 4, 10), iso(2026, 9, 4, 20)),
    ).toEqual({ date: "4 Sep 2026", time: "10:00 – 20:00" });
  });
  it("collapses a range inside one month", () => {
    expect(
      formatEventSchedule(iso(2026, 9, 5, 8), iso(2026, 9, 6, 18)),
    ).toEqual({ date: "5 – 6 Sep 2026", time: "08:00 – 18:00" });
  });
  it("names both months when the range crosses a month", () => {
    expect(
      formatEventSchedule(iso(2026, 8, 30, 9), iso(2026, 9, 2, 17, 30)).date,
    ).toBe("30 Aug – 2 Sep 2026");
  });
  it("names both years when the range crosses a year", () => {
    expect(formatEventSchedule(iso(2026, 12, 30), iso(2027, 1, 2)).date).toBe(
      "30 Dec 2026 – 2 Jan 2027",
    );
  });
  it("returns a dash for invalid dates", () => {
    expect(formatEventSchedule("", "x")).toEqual({ date: "-", time: "-" });
  });
});
