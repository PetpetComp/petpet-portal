"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { MatchPhase } from "@/domains/matches/phase";
import type { StopReason } from "@/domains/matches/types";
import type { Clock } from "@/domains/matches/time";
import { cn } from "@/lib/utils";
import type { TimerState } from "./race-timer";
import { RaceTimerDisplay } from "./race-timer-display";

/**
 * Teks baris status di bawah timer. Dipanggil dari layar Run Match.
 * `starting` = hitung mundur sudah habis dan timer lokal berjalan, tetapi server belum
 * mengonfirmasi start. `countdownSeconds` dipakai untuk "Ready - countdown 3-2-1 is on".
 */
export function statusLineText(
  phase: MatchPhase,
  starting: boolean,
  countdownSeconds: number,
  stopReason: StopReason | null,
): string {
  if (starting) return "Starting...";
  switch (phase) {
    case "IDLE":
    case "READY": {
      if (countdownSeconds <= 0) return "Ready";
      const digits = Array.from(
        { length: countdownSeconds },
        (_, i) => countdownSeconds - i,
      ).join("-");
      return `Ready - countdown ${digits} is on`;
    }
    case "COUNTDOWN":
      return `Countdown ${Array.from({ length: Math.max(1, countdownSeconds) }, (_, i) => Math.max(1, countdownSeconds) - i).join("..")}`;
    case "RUNNING":
      return "Running";
    case "STOPPED":
      return stopReason === "CUTOFF" ? "Cut-off reached" : "Finished";
    case "DONE":
      return "Result confirmed";
  }
}

/** Titik warna di depan baris status: hijau saat berjalan, oranye saat hitung mundur, abu-abu lainnya. */
function dotClass(phase: MatchPhase): string {
  if (phase === "RUNNING") return "bg-success";
  if (phase === "COUNTDOWN") return "bg-warning";
  return "bg-[#8a809e]";
}

/**
 * Panel kiri Run Match (desain A-Live): label OFFICIAL RACE TIMER, timer besar, baris status,
 * tombol hijau Start match, lalu Rematch dan Confirm result. Di HP panel ini ada di atas daftar lane.
 * Hanya tampilan: semua keputusan boleh/tidak datang dari props dan klik diteruskan ke layar.
 */
export function RunTimerPanel({
  timerState,
  clock,
  phase,
  statusLine,
  start,
  stop,
  rematch,
  confirm,
  footer,
}: {
  timerState: TimerState;
  clock: Clock;
  phase: MatchPhase;
  statusLine: string;
  /** Tombol utama Start match; `null` menyembunyikannya (match berjalan, berhenti, atau selesai). */
  start: { enabled: boolean; label: string; onClick: () => void } | null;
  /** Tombol Stop match (hanya saat RUNNING); `null` menyembunyikannya. */
  stop: { enabled: boolean; onClick: () => void } | null;
  /** `null` menyembunyikan baris Rematch dan Confirm (match selesai atau hanya baca). */
  rematch: { enabled: boolean; onClick: () => void } | null;
  confirm: { enabled: boolean; onClick: () => void; busy: boolean } | null;
  /** Catatan di dasar panel (mis. hanya baca, link kembali). */
  footer?: ReactNode;
}) {
  return (
    <section
      aria-label="Race timer"
      className="grid min-w-0 content-start gap-3"
    >
      <p className="text-muted-foreground text-[11px] font-bold tracking-widest">
        OFFICIAL RACE TIMER
      </p>
      <RaceTimerDisplay state={timerState} clock={clock} />
      <p className="flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full", dotClass(phase))}
        />
        <span data-testid="timer-status">{statusLine}</span>
      </p>
      {start && (
        <Button
          className="min-h-14 w-full rounded-xl bg-[#15803d] text-lg font-bold text-white hover:bg-[#166534]"
          disabled={!start.enabled}
          onClick={start.onClick}
        >
          {start.label}
        </Button>
      )}
      {stop && (
        <Button
          variant="secondary"
          className="min-h-14 w-full rounded-xl text-lg font-bold"
          disabled={!stop.enabled}
          onClick={stop.onClick}
        >
          Stop match
        </Button>
      )}
      {(rematch || confirm) && (
        <div className="grid grid-cols-2 gap-2.5">
          {rematch && (
            <Button
              variant="secondary"
              className="min-h-12 rounded-xl"
              disabled={!rematch.enabled}
              onClick={rematch.onClick}
            >
              Rematch
            </Button>
          )}
          {confirm && (
            <Button
              variant={confirm.enabled ? "primary" : "secondary"}
              className={cn(
                "min-h-12 rounded-xl",
                !confirm.enabled && "bg-primary-soft text-primary-dark/70",
              )}
              disabled={!confirm.enabled}
              onClick={confirm.onClick}
            >
              {confirm.busy ? "Confirming..." : "Confirm result"}
            </Button>
          )}
        </div>
      )}
      {footer}
    </section>
  );
}
