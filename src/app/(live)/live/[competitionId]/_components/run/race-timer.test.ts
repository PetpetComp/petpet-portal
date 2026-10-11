import { describe, expect, it } from "vitest";
import {
  IDLE_TIMER,
  isoSpanMs,
  resumeMark,
  timerCountdown,
  timerElapsed,
  timerReducer,
  type TimerState,
} from "./race-timer";

describe("timerReducer", () => {
  it("goes idle -> countdown -> running -> stopped", () => {
    const countdown = timerReducer(IDLE_TIMER, {
      type: "countdown",
      mark: 1000,
      totalSeconds: 3,
    });
    expect(countdown).toEqual({
      kind: "countdown",
      startMark: 1000,
      totalSeconds: 3,
    });
    const running = timerReducer(countdown, { type: "run", mark: 4000 });
    expect(running).toEqual({ kind: "running", startMark: 4000 });
    const stopped = timerReducer(running, { type: "stop", elapsedMs: 38412 });
    expect(stopped).toEqual({ kind: "stopped", elapsedMs: 38412 });
  });

  it("ignores invalid transitions", () => {
    const running: TimerState = { kind: "running", startMark: 10 };
    expect(
      timerReducer(running, { type: "countdown", mark: 1, totalSeconds: 3 }),
    ).toBe(running);
    const stopped: TimerState = { kind: "stopped", elapsedMs: 5 };
    expect(timerReducer(stopped, { type: "run", mark: 1 })).toBe(stopped);
    expect(timerReducer(stopped, { type: "stop", elapsedMs: 9 })).toBe(stopped);
    const countdown: TimerState = {
      kind: "countdown",
      startMark: 0,
      totalSeconds: 3,
    };
    expect(timerReducer(countdown, { type: "stop", elapsedMs: 9 })).toBe(
      countdown,
    );
  });

  it("allows resume (idle -> running) and loading a finished session (idle -> stopped)", () => {
    expect(timerReducer(IDLE_TIMER, { type: "run", mark: 50 })).toEqual({
      kind: "running",
      startMark: 50,
    });
    expect(timerReducer(IDLE_TIMER, { type: "stop", elapsedMs: 1200 })).toEqual(
      { kind: "stopped", elapsedMs: 1200 },
    );
  });

  it("reset always returns to idle, and a stopped time is never negative", () => {
    expect(
      timerReducer({ kind: "stopped", elapsedMs: 5 }, { type: "reset" }),
    ).toBe(IDLE_TIMER);
    expect(
      timerReducer(
        { kind: "running", startMark: 0 },
        { type: "stop", elapsedMs: -4 },
      ),
    ).toEqual({ kind: "stopped", elapsedMs: 0 });
  });
});

describe("timerElapsed and timerCountdown", () => {
  it("reads the running time from the clock, not from ticks", () => {
    const state: TimerState = { kind: "running", startMark: 1000 };
    expect(timerElapsed(state, () => 1000)).toBe(0);
    expect(timerElapsed(state, () => 39412)).toBe(38412);
  });

  it("returns the frozen time when stopped and 0 otherwise", () => {
    expect(timerElapsed({ kind: "stopped", elapsedMs: 777 }, () => 99999)).toBe(
      777,
    );
    expect(timerElapsed(IDLE_TIMER, () => 99999)).toBe(0);
  });

  it("counts down 3, 2, 1 then done", () => {
    const state: TimerState = {
      kind: "countdown",
      startMark: 0,
      totalSeconds: 3,
    };
    expect(timerCountdown(state, () => 0)).toEqual({
      secondsLeft: 3,
      done: false,
    });
    expect(timerCountdown(state, () => 1500)?.secondsLeft).toBe(2);
    expect(timerCountdown(state, () => 2800)?.secondsLeft).toBe(1);
    expect(timerCountdown(state, () => 3000)).toEqual({
      secondsLeft: 0,
      done: true,
    });
    expect(timerCountdown(IDLE_TIMER, () => 0)).toBeNull();
  });
});

describe("resume helpers", () => {
  it("resumeMark moves t0 back by the time already elapsed", () => {
    expect(resumeMark(5000, 20000)).toBe(15000);
    expect(resumeMark(-1, 20000)).toBe(20000);
  });

  it("isoSpanMs measures server timestamps and tolerates bad input", () => {
    const start = "2026-10-11T08:00:00.000Z";
    expect(isoSpanMs(start, "2026-10-11T08:00:38.412Z")).toBe(38412);
    expect(isoSpanMs(start, Date.parse(start) + 1000)).toBe(1000);
    expect(isoSpanMs(start, "2026-10-11T07:59:00.000Z")).toBe(0);
    expect(isoSpanMs(null, "2026-10-11T08:00:00.000Z")).toBeNull();
    expect(isoSpanMs(start, null)).toBeNull();
    expect(isoSpanMs("not a date", 5)).toBeNull();
  });
});
