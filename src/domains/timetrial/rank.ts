import { isTerminalState } from "./rules";
import type { QueueParticipant } from "./types";

/**
 * Logika murni peringkat waktu terbaik Time trial dan potongan data untuk panel layar
 * ("Best times so far", "Up next", "Participant 4 of 18"). Peringkat dihitung server/mock dengan
 * `rankBestTimes` dan dikirim sebagai `best_rank`; layar hanya mengurutkan dan memotong.
 */

/** Masukan satu peserta untuk `rankBestTimes`. */
export type RankInput = {
  entryId: string;
  /** Urutan hasil undian (tetap); pemutus terakhir bila waktu dan saat tercapai sama. */
  drawingOrder: number;
  /** Waktu terbaik (ms, sudah + penalti); null bila belum ada attempt FINISHED yang sah. */
  bestTimeMs: number | null;
  /** Kapan attempt terbaik berhenti (ISO); null dianggap paling akhir. */
  bestStoppedAt: string | null;
  /** Penalti DISQUALIFICATION aktif: keluar dari peringkat. */
  disqualified: boolean;
};

/** Membandingkan dua nilai yang boleh null; null dianggap paling akhir. */
function compareNullable(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * Peringkat peserta menurut waktu terbaik. Aturan:
 * 1. Hanya peserta dengan waktu sah dan tidak didiskualifikasi yang diberi peringkat.
 * 2. Waktu lebih kecil menang.
 * 3. Waktu sama: yang attempt terbaiknya lebih dulu tercapai (`bestStoppedAt` lebih awal).
 * 4. Masih sama: urutan undian lebih kecil.
 * Peringkat selalu unik 1..k (tidak ada peringkat kembar). Mengembalikan entryId -> peringkat.
 * Contoh: A 38412, B 41000, C 38412 yang tercapai lebih lambat dari A -> A=1, C=2, B=3.
 */
export function rankBestTimes(
  inputs: readonly RankInput[],
): Map<string, number> {
  const eligible = inputs.filter(
    (p) => p.bestTimeMs !== null && !p.disqualified,
  );
  const sorted = [...eligible].sort((a, b) => {
    if (a.bestTimeMs !== b.bestTimeMs)
      return (a.bestTimeMs as number) - (b.bestTimeMs as number);
    const byMoment = compareNullable(a.bestStoppedAt, b.bestStoppedAt);
    if (byMoment !== 0) return byMoment;
    return a.drawingOrder - b.drawingOrder;
  });
  return new Map(sorted.map((p, index) => [p.entryId, index + 1]));
}

/** Satu baris panel "Best times so far". */
export type BestTimeRow = {
  rank: number;
  entryId: string;
  petName: string;
  bibNumber: string;
  ownerName: string;
  timeMs: number;
  /** Nomor fisik attempt terbaik. */
  attemptNumber: number | null;
};

/**
 * Baris panel "Best times so far": peserta yang punya `bestRank`, urut peringkat, dipotong
 * `limit` teratas. Peringkat dan waktu datang dari server. Dipanggil dari `useBestTimes`.
 */
export function bestTimesPanel(
  participants: readonly QueueParticipant[],
  limit: number,
): BestTimeRow[] {
  return participants
    .filter((p) => p.bestRank !== null && p.bestTimeMs !== null)
    .sort((a, b) => (a.bestRank as number) - (b.bestRank as number))
    .slice(0, Math.max(0, limit))
    .map((p) => ({
      rank: p.bestRank as number,
      entryId: p.entryId,
      petName: p.petName,
      bibNumber: p.bibNumber,
      ownerName: p.ownerName,
      timeMs: p.bestTimeMs as number,
      attemptNumber: p.bestAttemptNumber,
    }));
}

/**
 * Peserta berikutnya untuk panel "Up next": yang belum DONE, DNS, atau DQ, selain peserta yang
 * sedang giliran, menurut urutan antrean, dipotong `limit`.
 */
export function upNext(
  participants: readonly QueueParticipant[],
  currentEntryId: string | null,
  limit: number,
): QueueParticipant[] {
  return [...participants]
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .filter((p) => p.entryId !== currentEntryId && !isTerminalState(p.state))
    .slice(0, Math.max(0, limit));
}

/**
 * "Participant 4 of 18" di header: jumlah peserta yang sudah selesai (DONE, DNS, DQ) ditambah
 * satu, tidak lebih dari total. Setelah semua selesai menunjukkan total.
 */
export function participantProgress(
  participants: readonly QueueParticipant[],
): {
  position: number;
  total: number;
} {
  const total = participants.length;
  const closed = participants.filter((p) => isTerminalState(p.state)).length;
  return { position: Math.min(total, closed + 1), total };
}
