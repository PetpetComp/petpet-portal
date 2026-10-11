"use client";
import { useEffect, useState } from "react";
import { formatTimer, type Clock } from "@/domains/matches/time";
import { cn } from "@/lib/utils";
import { timerCountdown, timerElapsed, type TimerState } from "./race-timer";

/**
 * Menggambar ulang komponen tiap frame browser selama `active`. Nilainya sendiri tidak dipakai:
 * tiap render menghitung waktu dari jam, jadi frame yang terlewat tidak membuat timer meleset.
 * Dibersihkan saat `active` berubah atau komponen dilepas.
 */
function useFrameTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => {
      setTick((t) => t + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

/**
 * Timer besar "00:00.000" (font mono). Dipanggil dari panel timer Run Match.
 * - idle: 00:00.000. countdown: angka besar 3, 2, 1 (memudar sederhana, tanpa animasi bila
 *   pengguna memilih reduced motion). running: waktu dari jam tiap frame. stopped: waktu beku.
 * - `role="timer"` dengan `aria-live="off"`: jam yang berjalan TIDAK diumumkan ke pembaca layar
 *   (finish diumumkan lewat region terpisah di layar).
 */
export function RaceTimerDisplay({
  state,
  clock,
  label = "Race timer",
  large = false,
}: {
  state: TimerState;
  clock: Clock;
  /** Nama timer untuk pembaca layar (Time trial memakai "Attempt timer"). */
  label?: string;
  /** Ukuran besar sampai 96px berwarna teks utama (layar Time trial); bawaan ukuran Run Match. */
  large?: boolean;
}) {
  useFrameTick(state.kind === "countdown" || state.kind === "running");
  const countdown = timerCountdown(state, clock);
  const text = countdown
    ? String(countdown.secondsLeft)
    : formatTimer(timerElapsed(state, clock));
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={label}
      data-timer-state={state.kind}
      className={cn(
        "min-w-0 font-mono leading-none font-bold tabular-nums",
        large
          ? "text-foreground text-[clamp(3rem,10vw,6rem)]"
          : "text-primary-dark text-[2.75rem] sm:text-6xl",
      )}
    >
      <span
        key={countdown ? text : "clock"}
        className={
          countdown ? "motion-safe:animate-[draw-fade_250ms_ease-out]" : ""
        }
      >
        {text}
      </span>
    </div>
  );
}
