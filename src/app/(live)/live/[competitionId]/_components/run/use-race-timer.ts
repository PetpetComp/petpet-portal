"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  cutoffRemainingMs,
  elapsedMs,
  isCutoffReached,
  performanceClock,
  type Clock,
} from "@/domains/matches/time";
import {
  IDLE_TIMER,
  resumeMark,
  timerElapsed,
  timerReducer,
} from "./race-timer";

type Options = {
  /** Jam (bawaan `performance.now`). Tes menyuntikkan jam palsu. */
  clock?: Clock;
  /** Batas waktu (ms) sesi; null bila tidak ada. Saat tercapai `onCutoff` dipanggil. */
  cutoffMs: number | null;
  /** Dipanggil SEKALI saat hitung mundur habis dan timer sudah berjalan (kirim POST start di sini). */
  onCountdownDone: () => void;
  /** Dipanggil SEKALI saat waktu berjalan mencapai cut-off (kirim stop CUTOFF di sini). */
  onCutoff: () => void;
};

/**
 * Hook timer resmi: membungkus `timerReducer` dengan jam dan penjadwal batas waktu.
 * Dipanggil dari layar Run Match.
 * - Nilai waktu TIDAK disimpan di state. Tampilan membacanya dari jam tiap frame
 *   (`RaceTimerDisplay` memakai requestAnimationFrame), dan tombol Finish memanggil `readElapsed()`
 *   di detik jari menekan.
 * - Akhir hitung mundur dan cut-off dijadwalkan dengan setTimeout ke batas waktunya (bukan
 *   setInterval yang menghitung tick) dan diperiksa ulang terhadap jam, jadi tetap benar bila
 *   timeout datang terlambat (tab di latar belakang: timeout tetap jalan, rAF berhenti).
 * - Semua timeout dibersihkan saat state berubah atau komponen dilepas.
 */
export function useRaceTimer({
  clock = performanceClock,
  cutoffMs,
  onCountdownDone,
  onCutoff,
}: Options) {
  const [state, dispatch] = useReducer(timerReducer, IDLE_TIMER);
  // Callback terbaru disimpan di ref supaya efek di bawah tidak dijadwalkan ulang tiap render.
  const handlers = useRef({ onCountdownDone, onCutoff });
  useEffect(() => {
    handlers.current = { onCountdownDone, onCutoff };
  });

  // Hitung mundur: jadwalkan pemeriksaan tepat di akhirnya.
  useEffect(() => {
    if (state.kind !== "countdown") return;
    let timeout: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = state.totalSeconds * 1000 - (clock() - state.startMark);
      if (state.totalSeconds <= 0 || remaining <= 0) {
        dispatch({ type: "run", mark: clock() });
        handlers.current.onCountdownDone();
        return;
      }
      timeout = setTimeout(check, Math.max(4, remaining));
    };
    timeout = setTimeout(check, 0);
    return () => clearTimeout(timeout);
  }, [state, clock]);

  // Cut-off: jadwalkan pemeriksaan tepat di batas waktu; resume yang sudah lewat langsung terpicu.
  useEffect(() => {
    if (state.kind !== "running") return;
    if (cutoffMs === null || cutoffMs <= 0) return;
    let timeout: ReturnType<typeof setTimeout>;
    const check = () => {
      const elapsed = elapsedMs(state.startMark, clock);
      if (isCutoffReached(elapsed, cutoffMs)) {
        dispatch({ type: "stop", elapsedMs: cutoffMs });
        handlers.current.onCutoff();
        return;
      }
      timeout = setTimeout(
        check,
        Math.max(4, cutoffRemainingMs(elapsed, cutoffMs) ?? 0),
      );
    };
    timeout = setTimeout(check, 0);
    return () => clearTimeout(timeout);
  }, [state, cutoffMs, clock]);

  /** Mulai hitung mundur sekarang (0 detik = langsung berjalan). */
  const startCountdown = useCallback(
    (totalSeconds: number) =>
      dispatch({ type: "countdown", mark: clock(), totalSeconds }),
    [clock],
  );
  /** Melanjutkan timer yang sudah berjalan `alreadyElapsedMs` (reload halaman). */
  const resume = useCallback(
    (alreadyElapsedMs: number) =>
      dispatch({ type: "run", mark: resumeMark(alreadyElapsedMs, clock()) }),
    [clock],
  );
  /** Membekukan timer di `frozenMs`; kosong = waktu saat ini (bila sedang berjalan). */
  const stop = (frozenMs?: number) =>
    dispatch({
      type: "stop",
      elapsedMs: frozenMs ?? timerElapsed(state, clock),
    });
  /** Memuat sesi yang sudah berhenti (reload): bekukan di `finalMs`. Hanya dari idle. */
  const showStopped = useCallback(
    (finalMs: number) => dispatch({ type: "stop", elapsedMs: finalMs }),
    [],
  );
  /** Kembali ke idle (Rematch). */
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  /** Waktu berjalan saat ini (ms); dipanggil di detik Finish ditekan. */
  const readElapsed = (): number => timerElapsed(state, clock);

  return {
    state,
    clock,
    startCountdown,
    resume,
    stop,
    showStopped,
    reset,
    readElapsed,
  };
}
