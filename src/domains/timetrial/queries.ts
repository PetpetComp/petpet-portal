import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { drawingKeys } from "@/domains/drawing/keys";
import {
  completeParticipant,
  createAttempt,
  disqualify,
  getQueue,
  markDns,
  recordTimerResult,
  reopenParticipant,
  retryAttempt,
  revokePenalty,
  skipParticipant,
  startAttempt,
  stopAndRecord,
  timeoutAttempt,
  voidAttempt,
  type CreateAttemptInput,
  type RecordTimerResultInput,
} from "./api";
import { BEST_TIMES_PANEL_SIZE } from "./constants";
import { timetrialKeys } from "./keys";
import { bestTimesPanel } from "./rank";
import type { RetryStatus } from "./types";

export { timetrialKeys };

/** Antrean satu kompetisi. `enabled=false` untuk tipe selain Time trial (tidak ada datanya). */
export function useQueue(competitionId: string, enabled = true) {
  return useQuery({
    queryKey: timetrialKeys.queue(competitionId),
    queryFn: () => getQueue(competitionId),
    enabled,
  });
}

/**
 * Panel "Best times so far" (keputusan kontrak 14: digabung ke antrean, tanpa endpoint kedua).
 * Memakai cache yang SAMA dengan `useQueue` (satu permintaan), hanya memilih baris berperingkat
 * teratas. `data` berisi `BestTimeRow[]`.
 */
export function useBestTimes(
  competitionId: string,
  limit = BEST_TIMES_PANEL_SIZE,
  enabled = true,
) {
  return useQuery({
    queryKey: timetrialKeys.queue(competitionId),
    queryFn: () => getQueue(competitionId),
    select: (queue) => bestTimesPanel(queue.participants, limit),
    enabled,
  });
}

/**
 * Pola bersama semua mutasi aksi: sukses atau gagal, ambil ulang antrean supaya `actions` dan
 * data layar selalu dari server (yang memegang aturan). Gagal pun menyegarkan: keadaan di server
 * mungkin sudah berubah (mis. attempt dihentikan dari perangkat lain). `alsoDrawing` untuk aksi
 * yang mengubah status match drawing (attempt pertama dimulai mengunci Swap).
 */
function useQueueRefresh(competitionId: string, alsoDrawing = false) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({
        queryKey: timetrialKeys.queue(competitionId),
      }),
      alsoDrawing
        ? client.invalidateQueries({
            queryKey: drawingKeys.forCompetition(competitionId),
          })
        : undefined,
    ]);
  return { onSuccess: refresh, onError: refresh };
}

/** Membuat attempt WAITING (dilanjutkan hitung mundur di layar lalu `useStartAttempt`). */
export function useCreateAttempt(competitionId: string) {
  return useMutation({
    mutationFn: (input: CreateAttemptInput) => createAttempt(input),
    ...useQueueRefresh(competitionId),
  });
}

/** Memulai attempt (dipanggil saat hitung mundur di layar habis). */
export function useStartAttempt(competitionId: string) {
  return useMutation({
    mutationFn: (attemptId: string) => startAttempt(attemptId),
    ...useQueueRefresh(competitionId, true),
  });
}

/**
 * Stop satu ketukan: stop lalu simpan waktu. Bila waktu gagal tersimpan, mutasi error dengan
 * `RecordTimerResultError` (attempt sudah di-stop); layar mencoba lagi lewat `useRecordResult`.
 * Antrean disegarkan di kedua hasil.
 */
export function useStopAttempt(competitionId: string) {
  return useMutation({
    mutationFn: (input: RecordTimerResultInput) => stopAndRecord(input),
    ...useQueueRefresh(competitionId),
  });
}

/** Retry menyimpan waktu attempt yang sudah di-stop (setelah `RecordTimerResultError`). */
export function useRecordResult(competitionId: string) {
  return useMutation({
    mutationFn: (input: RecordTimerResultInput) => recordTimerResult(input),
    ...useQueueRefresh(competitionId),
  });
}

/** Menghentikan attempt karena cut-off tercapai (status TIMEOUT). */
export function useTimeoutAttempt(competitionId: string) {
  return useMutation({
    mutationFn: (attemptId: string) => timeoutAttempt(attemptId),
    ...useQueueRefresh(competitionId),
  });
}

/** "Retry": membatalkan attempt aktif tanpa memakai jatah (FALSE_START bawaan, atau RETRY). */
export function useRetryAttempt(competitionId: string) {
  return useMutation({
    mutationFn: (v: { attemptId: string; reason?: RetryStatus }) =>
      retryAttempt(v.attemptId, v.reason),
    ...useQueueRefresh(competitionId),
  });
}

/** Undo attempt yang sudah selesai (status RETRY; jatahnya kembali). */
export function useUndoAttempt(competitionId: string) {
  return useMutation({
    mutationFn: (attemptId: string) => voidAttempt(attemptId),
    ...useQueueRefresh(competitionId),
  });
}

/** "Next participant": menyelesaikan giliran peserta. Argumen: `roundEntryId`. */
export function useCompleteParticipant(competitionId: string) {
  return useMutation({
    mutationFn: (roundEntryId: string) => completeParticipant(roundEntryId),
    ...useQueueRefresh(competitionId),
  });
}

/** Membuka lagi peserta DONE. Argumen: `roundEntryId`. */
export function useReopenParticipant(competitionId: string) {
  return useMutation({
    mutationFn: (roundEntryId: string) => reopenParticipant(roundEntryId),
    ...useQueueRefresh(competitionId),
  });
}

/**
 * "Skip to next": peserta ke akhir antrean. Jawaban API (antrean terbaru) langsung menggantikan
 * cache; gagal tetap menyegarkan.
 */
export function useSkipParticipant(competitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => skipParticipant(competitionId, entryId),
    onSuccess: (data) =>
      client.setQueryData(timetrialKeys.queue(competitionId), data),
    onError: () =>
      client.invalidateQueries({
        queryKey: timetrialKeys.queue(competitionId),
      }),
  });
}

/** Menandai (`dns: true`) atau membatalkan (`false`) Did not start satu peserta. */
export function useMarkDns(competitionId: string) {
  return useMutation({
    mutationFn: (v: { roundEntryId: string; dns: boolean }) =>
      markDns(v.roundEntryId, v.dns),
    ...useQueueRefresh(competitionId),
  });
}

/** Diskualifikasi satu peserta (penalti DISQUALIFICATION) dengan satu alasan. */
export function useDisqualify(competitionId: string) {
  return useMutation({
    mutationFn: (v: { entryId: string; reason: string }) =>
      disqualify(v.entryId, v.reason),
    ...useQueueRefresh(competitionId),
  });
}

/** Mencabut diskualifikasi (revoke penalti). */
export function useRevokePenalty(competitionId: string) {
  return useMutation({
    mutationFn: (penaltyId: string) => revokePenalty(penaltyId),
    ...useQueueRefresh(competitionId),
  });
}
