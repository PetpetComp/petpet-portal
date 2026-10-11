import type { MatchStatus } from "@/domains/drawing/types";
import type { MatchActions, RaceSessionStatus } from "./types";

/**
 * Mesin status fase layar Run Match. Fase = apa yang dilihat operator di layar, dan itu sedikit
 * lebih kaya daripada status sesi di server karena hitung mundur 3-2-1 hanya ada di klien
 * (backend tidak pernah menyimpan COUNTDOWN). Aturan yang sesungguhnya (siapa boleh, data
 * mengizinkan atau tidak) tetap dipegang backend lewat `match.actions`; fungsi di sini hanya
 * menambahkan batasan fase layar (mis. tombol Finish mati selama hitung mundur).
 */

export const MATCH_PHASES = [
  /** Belum ada sesi aktif: tombol "Prepare" (buat sesi) tersedia. */
  "IDLE",
  /** Sesi READY: tombol Start match tersedia. */
  "READY",
  /** Hitung mundur sedang berjalan di layar (sesi masih READY di server). */
  "COUNTDOWN",
  /** Sesi RUNNING: timer jalan, Finish aktif. */
  "RUNNING",
  /** Sesi FINISHED atau CUTOFF: timer berhenti, tinggal koreksi dan Confirm. */
  "STOPPED",
  /** Match sudah dikonfirmasi (hanya baca). */
  "DONE",
] as const;
export type MatchPhase = (typeof MATCH_PHASES)[number];

/**
 * Menentukan fase layar. `heatStatus` COMPLETED selalu DONE. Sesi null atau CANCELLED = IDLE.
 * Sesi READY menjadi COUNTDOWN bila layar sedang menghitung mundur (`countdownActive`) atau
 * server sudah mengirim COUNTDOWN. Dipanggil dari layar Run Match tiap render.
 */
export function phaseOf(
  heatStatus: MatchStatus,
  sessionStatus: RaceSessionStatus | null,
  countdownActive: boolean,
): MatchPhase {
  if (heatStatus === "COMPLETED") return "DONE";
  switch (sessionStatus) {
    case null:
    case "CANCELLED":
    case "REMATCHED":
      return "IDLE";
    case "READY":
      return countdownActive ? "COUNTDOWN" : "READY";
    case "COUNTDOWN":
      return "COUNTDOWN";
    case "RUNNING":
      return "RUNNING";
    case "FINISHED":
    case "CUTOFF":
      return "STOPPED";
  }
}

/** Aksi yang masuk akal di satu fase layar. */
export type PhaseAllowance = Pick<
  MatchActions,
  | "createSession"
  | "start"
  | "finish"
  | "stop"
  | "rematch"
  | "markDns"
  | "disqualify"
  | "confirm"
> & {
  /** Undo finish. */
  undoFinish: boolean;
};

const NONE: PhaseAllowance = {
  createSession: false,
  start: false,
  finish: false,
  stop: false,
  rematch: false,
  markDns: false,
  disqualify: false,
  confirm: false,
  undoFinish: false,
};

/**
 * Aksi yang diizinkan di tiap fase. Disusun dari tabel supaya mudah dibaca:
 * IDLE: buat sesi, DNS. READY: Start, DNS. COUNTDOWN: tidak ada (hitung mundur tidak bisa
 * ditimpa). RUNNING: Finish, undo, Stop, Rematch, DNS, Disqualify. STOPPED: undo, Rematch, DNS,
 * Disqualify, Confirm. DONE: tidak ada.
 */
export const PHASE_ALLOWANCE: Record<MatchPhase, PhaseAllowance> = {
  IDLE: { ...NONE, createSession: true, markDns: true },
  READY: { ...NONE, start: true, markDns: true },
  COUNTDOWN: { ...NONE },
  RUNNING: {
    ...NONE,
    finish: true,
    undoFinish: true,
    stop: true,
    rematch: true,
    markDns: true,
    disqualify: true,
  },
  STOPPED: {
    ...NONE,
    undoFinish: true,
    rematch: true,
    markDns: true,
    disqualify: true,
    confirm: true,
  },
  DONE: { ...NONE },
};

/**
 * Menggabungkan flag `actions` dari server dengan batasan fase layar (AND). Server menentukan
 * hak dan keadaan data; fase hanya mematikan tombol yang tidak pantas pada saat itu.
 * Dipanggil dari layar Run Match untuk tombol tingkat match.
 */
export function effectiveMatchActions(
  actions: MatchActions,
  phase: MatchPhase,
): MatchActions {
  const allow = PHASE_ALLOWANCE[phase];
  return {
    createSession: actions.createSession && allow.createSession,
    start: actions.start && allow.start,
    finish: actions.finish && allow.finish,
    stop: actions.stop && allow.stop,
    rematch: actions.rematch && allow.rematch,
    markDns: actions.markDns && allow.markDns,
    disqualify: actions.disqualify && allow.disqualify,
    confirm: actions.confirm && allow.confirm,
  };
}

/**
 * Apakah tombol aksi lane (`lane.actions.*`) boleh dipakai di fase ini. `kind` memilih aksi
 * fase yang sepadan. Dipanggil dari kartu lane bersama flag lane dari server.
 */
export function laneActionAllowed(
  phase: MatchPhase,
  kind: "finish" | "undoFinish" | "markDns" | "disqualify",
): boolean {
  return PHASE_ALLOWANCE[phase][kind];
}
