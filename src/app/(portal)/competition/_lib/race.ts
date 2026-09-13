export type RaceStatus =
  "Ready" | "Countdown" | "Running" | "Stopped" | "Saved";
export interface RaceState {
  status: RaceStatus;
  elapsed: number;
  captures: number[];
  countdown: number;
}
export type RaceAction =
  | { type: "countdown" }
  | { type: "count"; value: number }
  | { type: "start" }
  | { type: "tick"; value: number; cutoff: number }
  | { type: "capture"; value: number; limit: number; cutoff: number }
  | { type: "stop" }
  | { type: "reset" }
  | { type: "save" };
export const initialRace: RaceState = {
  status: "Ready",
  elapsed: 0,
  captures: [],
  countdown: 3,
};
export function raceReducer(state: RaceState, action: RaceAction): RaceState {
  switch (action.type) {
    case "countdown":
      return state.status === "Ready"
        ? { ...state, status: "Countdown", countdown: 3 }
        : state;
    case "count":
      return state.status === "Countdown"
        ? { ...state, countdown: action.value }
        : state;
    case "start":
      return state.status === "Countdown"
        ? { ...state, status: "Running", countdown: 0 }
        : state;
    case "tick":
      return state.status === "Running"
        ? {
            ...state,
            elapsed: Math.min(action.value, action.cutoff),
            status: action.value >= action.cutoff ? "Stopped" : "Running",
          }
        : state;
    case "capture":
      return state.status === "Running" &&
        action.value < action.cutoff &&
        state.captures.length < action.limit
        ? { ...state, captures: [...state.captures, action.value] }
        : state;
    case "stop":
      return state.status === "Running"
        ? { ...state, status: "Stopped" }
        : state;
    case "reset":
      return { ...initialRace, captures: [] };
    case "save":
      return state.status === "Stopped" ? { ...state, status: "Saved" } : state;
  }
}
export function formatRaceTime(milliseconds: number) {
  const value = Math.max(0, Math.floor(milliseconds));
  return (
    String(Math.floor(value / 60000)).padStart(2, "0") +
    ":" +
    String(Math.floor(value / 1000) % 60).padStart(2, "0") +
    "." +
    String(value % 1000).padStart(3, "0")
  );
}
export function validPositions(positions: string[], captureCount: number) {
  if (!positions.length || positions.some((value) => !value)) return false;
  const ranked = positions.filter((value) => !["DNS", "DSQ"].includes(value));
  return (
    ranked.length === captureCount &&
    ranked.every(
      (value) =>
        Number.isInteger(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= captureCount,
    ) &&
    new Set(ranked).size === ranked.length
  );
}
