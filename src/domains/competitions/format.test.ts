import { describe, expect, it } from "vitest";
import { formatDayTime, formatWindow } from "./format";

const iso = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("formatDayTime", () => {
  it("writes day, month name, year and time", () => {
    expect(formatDayTime(iso(2026, 9, 4, 10, 30))).toBe("4 Sep 2026, 10:30");
    expect(formatDayTime(iso(2026, 7, 12, 8, 0))).toBe("12 Jul 2026, 08:00");
  });
  it("shows a dash for empty or invalid dates", () => {
    expect(formatDayTime(null)).toBe("-");
    expect(formatDayTime("not a date")).toBe("-");
  });
});

describe("formatWindow", () => {
  it("shows the time range when both ends fall on one day", () => {
    expect(formatWindow(iso(2026, 9, 4, 6, 30), iso(2026, 9, 4, 10, 0))).toBe(
      "4 Sep 2026, 06:30 - 10:00",
    );
  });
  it("shows a day range with one year when it is the same year", () => {
    expect(formatWindow(iso(2026, 7, 12), iso(2026, 7, 26, 23, 59))).toBe(
      "12 Jul - 26 Jul 2026",
    );
  });
  it("shows both years when the range crosses a year", () => {
    expect(formatWindow(iso(2026, 12, 30), iso(2027, 1, 2))).toBe(
      "30 Dec 2026 - 2 Jan 2027",
    );
  });
});
