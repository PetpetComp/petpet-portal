import {
  countdownState,
  elapsedMs,
  performanceClock,
  type Clock,
  type CountdownState,
} from "@/domains/matches/time";

/**
 * Mesin status timer resmi Run Match (murni, tanpa React). Dipakai oleh `use-race-timer.ts`.
 * Tahap: idle -> countdown -> running -> stopped. State hanya menyimpan titik awal jam
 * (`startMark`, nilai `clock()`), BUKAN angka yang bertambah tiap tick. Waktu berjalan selalu
 * dihitung dari jam (`timerElapsed`), jadi tick yang telat atau terlewat tidak membuat timer
 * meleset (keputusan 2A: timer adalah jam klien).
 */
export type TimerState =
  | { kind: "idle" }
  | { kind: "countdown"; startMark: number; totalSeconds: number }
  | { kind: "running"; startMark: number }
  | { kind: "stopped"; elapsedMs: number };

export type TimerAction =
  /** Mulai hitung mundur `totalSeconds` detik pada jam `mark`. Hanya dari idle. */
  | { type: "countdown"; mark: number; totalSeconds: number }
  /** Mulai berjalan dengan t0 = `mark`. Dari countdown (start biasa) atau idle (resume setelah reload). */
  | { type: "run"; mark: number }
  /** Berhenti dan membekukan waktu di `elapsedMs`. Dari running, atau idle (memuat sesi yang sudah selesai). */
  | { type: "stop"; elapsedMs: number }
  /** Kembali ke idle (Rematch). Selalu boleh. */
  | { type: "reset" };

export const IDLE_TIMER: TimerState = { kind: "idle" };

/**
 * Transisi state timer. Dipanggil oleh `useReducer` di `use-race-timer.ts`.
 * Transisi yang tidak sah (mis. `run` saat sudah stopped) diabaikan dengan mengembalikan
 * state yang sama, supaya callback ganda (timeout dobel) tidak merusak timer.
 */
export function timerReducer(
  state: TimerState,
  action: TimerAction,
): TimerState {
  switch (action.type) {
    case "countdown":
      if (state.kind !== "idle") return state;
      return {
        kind: "countdown",
        startMark: action.mark,
        totalSeconds: action.totalSeconds,
      };
    case "run":
      if (state.kind !== "countdown" && state.kind !== "idle") return state;
      return { kind: "running", startMark: action.mark };
    case "stop":
      if (state.kind !== "running" && state.kind !== "idle") return state;
      return { kind: "stopped", elapsedMs: Math.max(0, action.elapsedMs) };
    case "reset":
      return IDLE_TIMER;
  }
}

/** Waktu yang ditampilkan di timer besar (ms): berjalan = dari jam, stopped = nilai beku, lainnya 0. */
export function timerElapsed(
  state: TimerState,
  clock: Clock = performanceClock,
): number {
  if (state.kind === "running") return elapsedMs(state.startMark, clock);
  if (state.kind === "stopped") return state.elapsedMs;
  return 0;
}

/** Keadaan hitung mundur bila state countdown; null pada tahap lain. */
export function timerCountdown(
  state: TimerState,
  clock: Clock = performanceClock,
): CountdownState | null {
  if (state.kind !== "countdown") return null;
  return countdownState(state.startMark, state.totalSeconds, clock);
}

/**
 * Titik awal jam untuk melanjutkan timer yang sudah berjalan `alreadyElapsedMs` (resume setelah
 * reload halaman). Dipanggil dari hook saat sesi di server RUNNING tetapi timer lokal idle.
 */
export function resumeMark(alreadyElapsedMs: number, now: number): number {
  return now - Math.max(0, alreadyElapsedMs);
}

/**
 * Selisih waktu (ms) antara timestamp ISO server dan titik kedua (ISO atau epoch ms); null bila
 * salah satunya kosong atau tidak valid. Dipakai untuk resume (`Date.now() - started_at`) dan
 * waktu akhir sesi (`stopped_at - started_at`).
 * CATATAN jam: nilainya memakai jam sistem (`Date`) perangkat dan server, bukan `performance.now`.
 * Bila jam perangkat meleset dari server, waktu hasil resume ikut meleset sebesar itu. Ini hanya
 * dipakai setelah reload; `captured_time_ms` tiap finish tetap berasal dari jam monotonik klien.
 */
export function isoSpanMs(
  fromIso: string | null,
  to: string | number | null,
): number | null {
  if (!fromIso || to === null) return null;
  const from = Date.parse(fromIso);
  const end = typeof to === "number" ? to : Date.parse(to);
  if (Number.isNaN(from) || Number.isNaN(end)) return null;
  return Math.max(0, end - from);
}
