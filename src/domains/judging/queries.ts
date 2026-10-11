import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureScorecard,
  getJudging,
  LockError,
  lockScorecard,
  saveJudgeNote,
  saveScores,
  submitAndLock,
  type EnsureScorecardInput,
  type ScoreChange,
} from "./api";
import { judgingKeys } from "./keys";
import { applyScorecard, applyScorecardCreated } from "./queue";
import type { Judging, Scorecard } from "./types";

export { judgingKeys };

/** Kriteria, antrean peserta, dan scorecard pemanggil satu kompetisi. `enabled=false` untuk tipe non-Contest. */
export function useJudging(competitionId: string, enabled = true) {
  return useQuery({
    queryKey: judgingKeys.forCompetition(competitionId),
    queryFn: () => getJudging(competitionId),
    enabled,
  });
}

/**
 * Pola bersama mutasi nilai: hasil server langsung ditulis ke cache `Judging` (`setQueryData`),
 * TANPA mengambil ulang antrean, supaya autosave tidak membuat layar berkedip. Bila gagal,
 * antrean diambil ulang agar layar kembali sinkron dengan server (yang memegang aturan).
 */
function useJudgingCache(competitionId: string) {
  const client = useQueryClient();
  const key = judgingKeys.forCompetition(competitionId);
  return {
    /** Menaruh scorecard hasil server ke cache. */
    putScorecard: (scorecard: Scorecard) =>
      client.setQueryData<Judging>(key, (old) =>
        old ? applyScorecard(old, scorecard) : old,
      ),
    /** Menandai peserta punya scorecard DRAFT. */
    putCreated: (entryId: string, scorecardId: string) =>
      client.setQueryData<Judging>(key, (old) =>
        old ? applyScorecardCreated(old, entryId, scorecardId) : old,
      ),
    refresh: () => client.invalidateQueries({ queryKey: key }),
  };
}

/**
 * Memastikan scorecard peserta ada (dibuat malas pada simpanan pertama). Mengembalikan id
 * scorecard. Sukses: peserta di cache menjadi DRAFT. Gagal: antrean diambil ulang.
 */
export function useEnsureScorecard(competitionId: string) {
  const cache = useJudgingCache(competitionId);
  return useMutation({
    mutationFn: (input: EnsureScorecardInput) => ensureScorecard(input),
    onSuccess: (scorecardId, input) =>
      cache.putCreated(input.entryId, scorecardId),
    onError: cache.refresh,
  });
}

/**
 * Menyimpan nilai kriteria yang berubah (hanya yang berubah). Dipanggil layar dengan debounce
 * (`AUTOSAVE_DEBOUNCE_MS`). Jawaban server langsung menggantikan peserta itu di cache.
 */
export function useSaveScores(competitionId: string) {
  const cache = useJudgingCache(competitionId);
  return useMutation({
    mutationFn: (v: { scorecardId: string; changes: readonly ScoreChange[] }) =>
      saveScores(v.scorecardId, v.changes),
    onSuccess: cache.putScorecard,
    onError: cache.refresh,
  });
}

/** Menyimpan catatan juri keseluruhan (autosave juga). */
export function useSaveJudgeNote(competitionId: string) {
  const cache = useJudgingCache(competitionId);
  return useMutation({
    mutationFn: (v: { scorecardId: string; note: string }) =>
      saveJudgeNote(v.scorecardId, v.note),
    onSuccess: cache.putScorecard,
    onError: cache.refresh,
  });
}

/**
 * Submit lalu lock. Bila lock gagal, mutasi error dengan `LockError`: cache sudah menampilkan
 * peserta sebagai SUBMITTED dan layar mencoba lagi lewat `useRetryLock`. Error lain: antrean
 * diambil ulang.
 */
export function useSubmitAndLock(competitionId: string) {
  const cache = useJudgingCache(competitionId);
  return useMutation({
    mutationFn: (v: { scorecardId: string; judgeNote?: string }) =>
      submitAndLock(v.scorecardId, v.judgeNote),
    onSuccess: cache.putScorecard,
    onError: (error) => {
      if (error instanceof LockError) cache.putScorecard(error.submitted);
      else cache.refresh();
    },
  });
}

/** Mengulang Lock saja (setelah `LockError`). Argumen: id scorecard. */
export function useRetryLock(competitionId: string) {
  const cache = useJudgingCache(competitionId);
  return useMutation({
    mutationFn: (scorecardId: string) => lockScorecard(scorecardId),
    onSuccess: cache.putScorecard,
    onError: cache.refresh,
  });
}
