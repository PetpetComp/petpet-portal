import type { MatchPhase } from "@/domains/matches/phase";
import type { LaneOutcome, MatchLane } from "@/domains/matches/types";
import type { PendingFinish } from "./finish-queue";

/** Chip status di kartu lane. */
export type LaneChip =
  "FINISHED" | "DNS" | "DQ" | "DNF" | "PENDING" | "NOT_ASSIGNED";

export const LANE_CHIP_LABEL: Record<LaneChip, string> = {
  FINISHED: "Finished",
  DNS: "DNS",
  DQ: "DQ",
  DNF: "DNF",
  PENDING: "Pending",
  NOT_ASSIGNED: "Not assigned",
};

/** Apa yang ditampilkan kartu lane: chip, waktu (ms, null = "-"), dan peringkat sementara. */
export type LaneView = {
  chip: LaneChip | null;
  timeMs: number | null;
  /** Peringkat di antara lane yang sudah finish (1 = tercepat); null bila belum finish. */
  rank: number | null;
  /** True bila peringkat sudah final (match DONE), bukan "so far". */
  final: boolean;
};

/**
 * Menentukan tampilan satu lane dari data server, item antrean, dan hasil sementara.
 * Dipanggil dari layar Run Match untuk tiap lane. Urutan prioritas:
 * 1. Item antrean lane ini (ketukan yang belum tersimpan): waktu lokal, chip sesuai status
 *    (sending tampil Finished karena optimistic UI).
 * 2. Match DONE: pakai hasil tertulis server (`callStatus`, `position`, `completedTimeMs`).
 * 3. Selain itu: `outcome` hasil `matchOutcomes`. DNF baru ditampilkan setelah sesi berhenti,
 *    karena selama balapan "belum finish" belum berarti DNF.
 */
export function laneView(
  lane: MatchLane,
  pending: PendingFinish | null,
  outcome: LaneOutcome | null,
  phase: MatchPhase,
): LaneView {
  if (pending) {
    const chip: LaneChip =
      pending.status === "sending"
        ? "FINISHED"
        : pending.status === "unassigned"
          ? "NOT_ASSIGNED"
          : "PENDING";
    return { chip, timeMs: pending.capturedTimeMs, rank: null, final: false };
  }
  if (phase === "DONE") {
    const status = lane.callStatus;
    if (status === "FINISHED")
      return {
        chip: "FINISHED",
        timeMs: lane.completedTimeMs,
        rank: lane.position,
        final: true,
      };
    if (status === "DNF" || status === "DQ" || status === "DNS")
      return { chip: status, timeMs: null, rank: null, final: false };
    return { chip: null, timeMs: null, rank: null, final: false };
  }
  if (!outcome) return { chip: null, timeMs: null, rank: null, final: false };
  if (outcome.status === "FINISHED")
    return {
      chip: "FINISHED",
      timeMs: outcome.completedTimeMs,
      rank: outcome.position,
      final: false,
    };
  if (outcome.status === "DNF")
    return {
      chip: phase === "STOPPED" ? "DNF" : null,
      timeMs: null,
      rank: null,
      final: false,
    };
  return { chip: outcome.status, timeMs: null, rank: null, final: false };
}

/** Angka urutan dalam bahasa Inggris: 1 -> "1st", 2 -> "2nd", 11 -> "11th", 22 -> "22nd". */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
