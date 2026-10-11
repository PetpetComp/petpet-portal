import { describe, expect, it } from "vitest";
import {
  countdownState,
  cutoffRemainingMs,
  elapsedMs,
  formatCutoff,
  formatTimer,
  isCutoffReached,
  nextFinishOrder,
  nextSessionNumber,
  type Clock,
} from "./time";

/** Jam palsu yang bisa dimajukan tanpa menunggu. */
function fakeClock(start = 1000) {
  let now = start;
  const clock: Clock = () => now;
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("formatTimer", () => {
  it("formats milliseconds as MM:SS.mmm", () => {
    expect(formatTimer(0)).toBe("00:00.000");
    expect(formatTimer(38412)).toBe("00:38.412");
    expect(formatTimer(61005)).toBe("01:01.005");
    expect(formatTimer(599999)).toBe("09:59.999");
  });
  it("switches to H:MM:SS.mmm after one hour", () => {
    expect(formatTimer(3600000)).toBe("1:00:00.000");
    expect(formatTimer(3723456)).toBe("1:02:03.456");
    expect(formatTimer(36000000)).toBe("10:00:00.000");
  });
  it("never shows NaN or a negative time", () => {
    expect(formatTimer(-5)).toBe("00:00.000");
    expect(formatTimer(Number.NaN)).toBe("00:00.000");
    expect(formatTimer(Number.POSITIVE_INFINITY)).toBe("00:00.000");
  });
  it("rounds a fractional performance.now value", () => {
    expect(formatTimer(1234.6)).toBe("00:01.235");
  });
});

describe("formatCutoff", () => {
  it("formats the cut-off as MM:SS", () => {
    expect(formatCutoff(90000)).toBe("01:30");
    expect(formatCutoff(600000)).toBe("10:00");
    expect(formatCutoff(59999)).toBe("00:59");
  });
  it("handles more than one hour and bad input", () => {
    expect(formatCutoff(3600000)).toBe("1:00:00");
    expect(formatCutoff(-1)).toBe("00:00");
    expect(formatCutoff(Number.NaN)).toBe("00:00");
  });
});

describe("elapsedMs", () => {
  it("measures from the start mark with the injected clock", () => {
    const { clock, advance } = fakeClock(5000);
    const mark = clock();
    expect(elapsedMs(mark, clock)).toBe(0);
    advance(1234);
    expect(elapsedMs(mark, clock)).toBe(1234);
    advance(40000);
    expect(elapsedMs(mark, clock)).toBe(41234);
  });
  it("rounds to whole milliseconds and never goes negative", () => {
    expect(elapsedMs(100, () => 1100.4)).toBe(1000);
    expect(elapsedMs(100, () => 1100.6)).toBe(1001);
    expect(elapsedMs(500, () => 100)).toBe(0);
  });
});

describe("countdownState", () => {
  it("counts 3, 2, 1 then is done", () => {
    const { clock, advance } = fakeClock();
    const mark = clock();
    expect(countdownState(mark, 3, clock)).toEqual({
      secondsLeft: 3,
      done: false,
    });
    advance(1);
    expect(countdownState(mark, 3, clock).secondsLeft).toBe(3);
    advance(999);
    expect(countdownState(mark, 3, clock)).toEqual({
      secondsLeft: 2,
      done: false,
    });
    advance(1000);
    expect(countdownState(mark, 3, clock)).toEqual({
      secondsLeft: 1,
      done: false,
    });
    advance(999);
    expect(countdownState(mark, 3, clock)).toEqual({
      secondsLeft: 1,
      done: false,
    });
    advance(1);
    expect(countdownState(mark, 3, clock)).toEqual({
      secondsLeft: 0,
      done: true,
    });
    advance(5000);
    expect(countdownState(mark, 3, clock).done).toBe(true);
  });
  it("is done at once when the countdown is off", () => {
    const { clock } = fakeClock();
    expect(countdownState(clock(), 0, clock)).toEqual({
      secondsLeft: 0,
      done: true,
    });
  });
});

describe("cut-off helpers", () => {
  it("detects the cut-off at or after the limit", () => {
    expect(isCutoffReached(89999, 90000)).toBe(false);
    expect(isCutoffReached(90000, 90000)).toBe(true);
    expect(isCutoffReached(120000, 90000)).toBe(true);
  });
  it("treats null and 0 as no cut-off", () => {
    expect(isCutoffReached(999999, null)).toBe(false);
    expect(isCutoffReached(999999, 0)).toBe(false);
    expect(cutoffRemainingMs(1000, null)).toBeNull();
    expect(cutoffRemainingMs(1000, 0)).toBeNull();
  });
  it("gives the remaining time, never negative", () => {
    expect(cutoffRemainingMs(30000, 90000)).toBe(60000);
    expect(cutoffRemainingMs(95000, 90000)).toBe(0);
  });
});

describe("nextFinishOrder and nextSessionNumber", () => {
  it("starts at 1 and continues after the highest used number, voided ones included", () => {
    expect(nextFinishOrder([])).toBe(1);
    expect(nextFinishOrder([{ finishOrder: 1 }, { finishOrder: 2 }])).toBe(3);
    // Setelah undo capture 2 (VOID) nomor 2 tetap terpakai.
    expect(nextFinishOrder([{ finishOrder: 2 }, { finishOrder: 1 }])).toBe(3);
  });
  it("numbers sessions per match", () => {
    expect(nextSessionNumber([])).toBe(1);
    expect(nextSessionNumber([{ number: 1 }, { number: 2 }])).toBe(3);
  });
});
