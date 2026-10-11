/**
 * Logika murni antrean juri dan pembaruan cache `Judging` setelah satu scorecard berubah.
 * Dipakai layar (progres, tombol "next") dan queries.ts (autosave tanpa refetch).
 */
import { validateScorecard, weightedTotal } from "./scoring";
import type {
  Judging,
  JudgingParticipant,
  JudgingStatus,
  Scorecard,
} from "./types";

/** Bagian peserta yang dibutuhkan fungsi antrean. */
type QueueItem = { entryId: string; status: JudgingStatus };

/** Progres antrean untuk pemanggil. */
export type QueueProgress = {
  total: number;
  /** SUBMITTED atau LOCKED: pekerjaan juri untuk peserta itu selesai. */
  scored: number;
  /** DRAFT: sudah dimulai tetapi belum dikirim. */
  draft: number;
  notScored: number;
  /** Persen selesai 0 sampai 100, dibulatkan; 0 untuk antrean kosong. */
  percent: number;
};

/**
 * Menghitung progres antrean. Contoh 7 peserta: 2 LOCKED, 1 DRAFT, 4 NOT_SCORED ->
 * scored 2, draft 1, notScored 4, percent 29.
 */
export function queueProgress(
  queue: readonly Pick<QueueItem, "status">[],
): QueueProgress {
  let scored = 0;
  let draft = 0;
  let notScored = 0;
  for (const item of queue) {
    if (item.status === "LOCKED" || item.status === "SUBMITTED") scored++;
    else if (item.status === "DRAFT") draft++;
    else notScored++;
  }
  const total = queue.length;
  return {
    total,
    scored,
    draft,
    notScored,
    percent: total === 0 ? 0 : Math.round((scored / total) * 100),
  };
}

/**
 * Peserta berikutnya yang masih perlu dikerjakan (NOT_SCORED atau DRAFT) setelah `currentId`,
 * menurut urutan antrean dan berputar kembali ke awal. Peserta saat ini tidak dihitung.
 * Null bila tidak ada lagi. `currentId` null atau tidak ada di antrean -> mulai dari awal.
 */
export function nextUnscored(
  queue: readonly QueueItem[],
  currentId: string | null,
): string | null {
  const start = currentId
    ? queue.findIndex((item) => item.entryId === currentId)
    : -1;
  for (let step = 1; step <= queue.length; step++) {
    const item = queue[(start + step) % queue.length];
    if (item.entryId === currentId) continue;
    if (item.status === "NOT_SCORED" || item.status === "DRAFT")
      return item.entryId;
  }
  return null;
}

/** Mengganti satu peserta di antrean dan menghitung ulang `scoredCount`. */
function withParticipant(
  judging: Judging,
  entryId: string,
  change: (p: JudgingParticipant) => JudgingParticipant,
): Judging {
  const participants = judging.participants.map((p) =>
    p.entryId === entryId ? change(p) : p,
  );
  return {
    ...judging,
    participants,
    scoredCount: queueProgress(participants).scored,
  };
}

/**
 * Menaruh scorecard hasil server (PUT/PATCH/lock) ke cache `Judging`: status, nilai, catatan,
 * total, dan `actions`. Mencerminkan aturan mock: `score` = pemanggil juri dan masih DRAFT;
 * `submit` = boleh `score` dan `validateScorecard` lolos. Dipanggil dari queries.ts supaya
 * autosave tidak perlu mengambil ulang seluruh antrean (tidak berkedip). Kesalahan kecil di sini
 * dikoreksi oleh refetch berikutnya.
 */
export function applyScorecard(
  judging: Judging,
  scorecard: Scorecard,
): Judging {
  return withParticipant(judging, scorecard.entryId, (p) => {
    const editable = judging.canScore && scorecard.status === "DRAFT";
    return {
      ...p,
      scorecardId: scorecard.id,
      status: scorecard.status,
      scores: scorecard.scores,
      judgeNote: scorecard.judgeNote,
      total:
        Object.keys(scorecard.scores).length > 0
          ? weightedTotal(judging.criteria, scorecard.scores)
          : null,
      submittedAt: scorecard.submittedAt,
      lockedAt: scorecard.lockedAt,
      actions: {
        score: editable,
        submit:
          editable &&
          validateScorecard(judging.criteria, scorecard.scores).valid,
      },
    };
  });
}

/**
 * Setelah scorecard dibuat (`ensureScorecard`): peserta NOT_SCORED menjadi DRAFT dengan id
 * scorecard-nya. Peserta yang sudah punya scorecard tidak diubah selain id.
 */
export function applyScorecardCreated(
  judging: Judging,
  entryId: string,
  scorecardId: string,
): Judging {
  return withParticipant(judging, entryId, (p) => ({
    ...p,
    scorecardId,
    status: p.status === "NOT_SCORED" ? "DRAFT" : p.status,
  }));
}
