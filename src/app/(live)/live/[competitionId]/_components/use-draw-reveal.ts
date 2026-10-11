import { useCallback, useEffect, useRef, useState } from "react";
import { REVEAL_TICK_MS, revealTiming, settledCountAt } from "./draw-reveal";

/** True bila pengguna meminta gerak dikurangi (atau matchMedia tidak ada, mis. di server). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook penggerak animasi reveal. Dipanggil dari DraftDrawing.
 * Input: jumlah slot. Output: `revealing`, `frame` (untuk nama yang berputar), `settledCount`
 * (slot yang sudah mengendap), `started`, `completions`, serta `start()` dan `skip()`.
 * Satu setInterval (70ms) menaikkan frame; settledCount diturunkan dari waktu (frame * 70ms).
 * `start()` selalu mengulang dari nol (timer lama dibersihkan). Timer dibersihkan saat unmount.
 * Bila prefers-reduced-motion aktif, `start()` langsung selesai tanpa animasi.
 */
export function useDrawReveal(slotCount: number) {
  // null = tidak sedang reveal (semua slot mengendap).
  const [frame, setFrame] = useState<number | null>(null);
  // Sudah pernah ada reveal di layar ini (agar efek "pop" tidak muncul saat load awal).
  const [started, setStarted] = useState(false);
  // Naik tiap reveal selesai (alami, skip, atau reduced motion); dipakai untuk pengumuman.
  const [completions, setCompletions] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const finish = useCallback(() => {
    stopTimer();
    setFrame(null);
    setCompletions((count) => count + 1);
  }, [stopTimer]);

  const start = useCallback(() => {
    stopTimer();
    if (slotCount <= 0 || prefersReducedMotion()) {
      setFrame(null);
      setCompletions((count) => count + 1);
      return;
    }
    const { totalMs } = revealTiming(slotCount);
    let current = 0;
    setStarted(true);
    setFrame(0);
    timerRef.current = setInterval(() => {
      current += 1;
      if (current * REVEAL_TICK_MS >= totalMs) finish();
      else setFrame(current);
    }, REVEAL_TICK_MS);
  }, [slotCount, stopTimer, finish]);

  return {
    revealing: frame !== null,
    frame: frame ?? 0,
    settledCount:
      frame === null
        ? slotCount
        : settledCountAt(frame * REVEAL_TICK_MS, slotCount),
    started,
    completions,
    start,
    skip: finish,
  };
}
