"use client";
import { queueProgress } from "@/domains/judging/queue";
import { useJudging } from "@/domains/judging/queries";

/**
 * Pil "k of N scored" di header Live Mode (hanya Contest). Dipanggil dari live-shell.
 * Memakai cache yang sama dengan layar Judging, jadi ikut bergerak saat skor di-lock.
 * Belum dimuat atau gagal -> tidak tampil (layar Judging menampilkan errornya sendiri).
 */
export function JudgingProgressPill({
  competitionId,
}: {
  competitionId: string;
}) {
  const judging = useJudging(competitionId);
  if (!judging.data) return null;
  const progress = queueProgress(judging.data.participants);
  return (
    <span className="bg-judging-soft text-judging-ink rounded-full px-3 py-1.5 text-[13px] font-bold">
      {progress.scored} of {progress.total} scored
    </span>
  );
}
