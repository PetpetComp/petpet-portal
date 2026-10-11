import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { drawingKeys } from "@/domains/drawing/keys";
import { resultKeys } from "@/domains/results/queries";
import {
  assignFinish,
  captureAndAssign,
  confirmMatch,
  createSession,
  disqualify,
  getMatch,
  getMatches,
  markDns,
  revokePenalty,
  startSession,
  stopSession,
  voidFinish,
  type CaptureFinishInput,
  type CreateSessionInput,
} from "./api";
import { matchKeys } from "./keys";
import type { LaneOutcome, StopReason } from "./types";

export { matchKeys };

/** Daftar match satu kompetisi. `enabled=false` untuk tipe selain Race (tidak ada datanya). */
export function useMatches(competitionId: string, enabled = true) {
  return useQuery({
    queryKey: matchKeys.list(competitionId),
    queryFn: () => getMatches(competitionId),
    enabled,
  });
}

/** Satu match lengkap (lane, sesi, finish, penalti, `actions`). */
export function useMatch(matchId: string, enabled = true) {
  return useQuery({
    queryKey: matchKeys.detail(matchId),
    queryFn: () => getMatch(matchId),
    enabled,
  });
}

/**
 * Pola bersama semua mutasi aksi: sukses atau gagal, ambil ulang match supaya `actions` dan
 * data layar selalu dari server (yang memegang aturan), dan segarkan daftar match
 * (status dan ringkasan sesi ikut berubah). Gagal pun menyegarkan: keadaan di server mungkin
 * sudah berubah (mis. sesi dihentikan dari perangkat lain).
 */
function useMatchRefresh(matchId: string, alsoDrawing = false) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: matchKeys.detail(matchId) }),
      client.invalidateQueries({ queryKey: matchKeys.lists() }),
      // Start mengubah status heat, dan Swap di drawing bergantung padanya.
      alsoDrawing
        ? client.invalidateQueries({ queryKey: drawingKeys.all })
        : undefined,
    ]);
  return { onSuccess: refresh, onError: refresh };
}

/** Membuat sesi READY (butuh `actions.createSession`). */
export function useCreateSession(matchId: string) {
  return useMutation({
    mutationFn: (input: CreateSessionInput) => createSession(matchId, input),
    ...useMatchRefresh(matchId),
  });
}

/** Memulai sesi (dipanggil saat hitung mundur di layar habis). */
export function useStartSession(matchId: string) {
  return useMutation({
    mutationFn: (sessionId: string) => startSession(sessionId),
    ...useMatchRefresh(matchId, true),
  });
}

/** Menghentikan sesi dengan satu alasan (MANUAL, ALL_FINISHED, CUTOFF, TECHNICAL_ISSUE). */
export function useStopSession(matchId: string) {
  return useMutation({
    mutationFn: (v: { sessionId: string; reason: StopReason }) =>
      stopSession(v.sessionId, v.reason),
    ...useMatchRefresh(matchId),
  });
}

/**
 * Finish satu ketukan: capture lalu assign. Bila assign gagal, mutasi error dengan
 * `AssignFinishError` (capture sudah tersimpan UNASSIGNED); layar mencoba lagi lewat
 * `useAssignFinish`. Match disegarkan di kedua hasil.
 */
export function useCaptureFinish(matchId: string) {
  return useMutation({
    mutationFn: (input: CaptureFinishInput) => captureAndAssign(input),
    ...useMatchRefresh(matchId),
  });
}

/** Retry assign sebuah capture yang tertinggal UNASSIGNED (setelah `AssignFinishError`). */
export function useAssignFinish(matchId: string) {
  return useMutation({
    mutationFn: (v: { captureId: string; entryId: string }) =>
      assignFinish(v.captureId, v.entryId),
    ...useMatchRefresh(matchId),
  });
}

/** Undo satu finish (void). */
export function useVoidFinish(matchId: string) {
  return useMutation({
    mutationFn: (captureId: string) => voidFinish(captureId),
    ...useMatchRefresh(matchId),
  });
}

/**
 * Rematch: sesi baru berstatus rematch dari sesi sekarang (satu panggilan; server menandai sesi
 * lama REMATCHED, juga bila sesi lama masih RUNNING). Input sama dengan membuat sesi, dengan
 * `rematchOfSessionId` terisi.
 */
export function useRematch(matchId: string) {
  return useMutation({
    mutationFn: (input: CreateSessionInput & { rematchOfSessionId: string }) =>
      createSession(matchId, input),
    ...useMatchRefresh(matchId),
  });
}

/** Menandai (`dns: true`) atau membatalkan (`false`) Did not start satu lane. */
export function useMarkDns(matchId: string) {
  return useMutation({
    mutationFn: (v: { heatEntryId: string; dns: boolean }) =>
      markDns(v.heatEntryId, v.dns),
    ...useMatchRefresh(matchId),
  });
}

/** Diskualifikasi satu peserta (penalti DISQUALIFICATION) dengan satu alasan. */
export function useDisqualify(matchId: string) {
  return useMutation({
    mutationFn: (v: { entryId: string; reason: string }) =>
      disqualify(v.entryId, v.reason),
    ...useMatchRefresh(matchId),
  });
}

/** Mencabut diskualifikasi (revoke penalti). */
export function useRevokePenalty(matchId: string) {
  return useMutation({
    mutationFn: (penaltyId: string) => revokePenalty(penaltyId),
    ...useMatchRefresh(matchId),
  });
}

/**
 * Confirm hasil match (atomik). Jawaban API (match DONE) langsung menggantikan cache detail.
 * Hasil kompetisi (Results) dan drawing (status match) ikut berubah, jadi keduanya dibuang dari
 * cache. Gagal tetap menyegarkan match.
 */
export function useConfirmMatch(matchId: string, competitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (outcomes: readonly LaneOutcome[]) =>
      confirmMatch(matchId, outcomes),
    onSuccess: (data) => {
      client.setQueryData(matchKeys.detail(matchId), data);
      return Promise.all([
        client.invalidateQueries({ queryKey: matchKeys.lists() }),
        client.invalidateQueries({
          queryKey: resultKeys.forCompetition(competitionId),
        }),
        client.invalidateQueries({
          queryKey: drawingKeys.forCompetition(competitionId),
        }),
      ]);
    },
    onError: () =>
      client.invalidateQueries({ queryKey: matchKeys.detail(matchId) }),
  });
}
