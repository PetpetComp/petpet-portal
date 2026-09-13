"use client";
import { useEffect, useReducer, useRef } from "react";
import { initialRace, raceReducer } from "../_lib/race";
export function useRaceController(cutoff: number, participantCount: number) {
  const [state, dispatch] = useReducer(raceReducer, initialRace);
  const startedAt = useRef(0);
  useEffect(() => {
    if (state.status !== "Countdown") return;
    const countdownAt = performance.now();
    const interval = setInterval(() => {
      const remaining =
        3 - Math.floor((performance.now() - countdownAt) / 1000);
      if (remaining <= 0) {
        startedAt.current = performance.now();
        dispatch({ type: "start" });
      } else dispatch({ type: "count", value: remaining });
    }, 100);
    return () => clearInterval(interval);
  }, [state.status]);
  useEffect(() => {
    if (state.status !== "Running") return;
    const interval = setInterval(
      () =>
        dispatch({
          type: "tick",
          value: performance.now() - startedAt.current,
          cutoff,
        }),
      30,
    );
    return () => clearInterval(interval);
  }, [state.status, cutoff]);
  return {
    state,
    dispatch,
    capture: () =>
      dispatch({
        type: "capture",
        value: performance.now() - startedAt.current,
        limit: participantCount,
        cutoff,
      }),
  };
}
