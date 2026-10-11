/**
 * Logika murni hasil Contest (tanpa jaringan dan tanpa React): menggabung nilai beberapa juri
 * menjadi satu angka per peserta, lalu meranking. Dipakai mock (sampai backend punya endpoint
 * hasil) dan tesnya. Aturan gabung (keputusan P10 nomor 1A):
 * - Hanya scorecard LOCKED yang dihitung.
 * - Nilai peserta = rata-rata total tiap juri (total 0-100, rumus `weightedTotal`), 1 desimal.
 * - Nilai sama: bandingkan rata-rata persen kriteria berbobot terbesar, lalu kriteria
 *   berbobot terbesar berikutnya, dan seterusnya.
 * - Masih sama: peringkat kembar (1, 1, 3), bukan diurutkan paksa.
 */
import {
  scoreToPercent,
  weightedTotal,
  type CriterionRule,
} from "@/domains/judging/scoring";
import type { ScoreMap } from "@/domains/judging/types";

/** Satu scorecard LOCKED milik satu juri untuk satu peserta. */
export type LockedCard = { scores: ScoreMap };

/** Hasil gabungan satu peserta. */
export type CombinedScore = {
  /** Rata-rata total juri (0-100, 1 desimal); null bila belum ada scorecard LOCKED. */
  score: number | null;
  /** Jumlah juri yang ikut dihitung. */
  judges: number;
  /** Rata-rata persen per kriteria, urut dari bobot terbesar; dipakai sebagai pemutus seri. */
  tieBreak: number[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Menggabung scorecard LOCKED satu peserta. Contoh bobot 40/30/30, rentang 0..10:
 * juri A memberi 8, 6, 9 (total 77) dan juri B 6, 8, 7 (total 69) -> nilai 73.
 * Tanpa scorecard: `score` null dan `judges` 0.
 */
export function combineJudges(
  criteria: readonly Pick<CriterionRule, "id" | "weight" | "min" | "max">[],
  cards: readonly LockedCard[],
): CombinedScore {
  if (cards.length === 0) return { score: null, judges: 0, tieBreak: [] };
  const score = round1(
    average(cards.map((card) => weightedTotal(criteria, card.scores))),
  );
  const byWeight = [...criteria].sort((a, b) => b.weight - a.weight);
  const tieBreak = byWeight.map((criterion) =>
    average(
      cards.map((card) => {
        const value = card.scores[criterion.id]?.score;
        return value === null || value === undefined
          ? 0
          : scoreToPercent(criterion, value);
      }),
    ),
  );
  return { score, judges: cards.length, tieBreak };
}

/** Membandingkan dua vektor pemutus seri; angka positif bila `a` lebih baik (lebih tinggi). */
function compareTieBreak(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (Math.abs(diff) > 1e-9) return diff;
  }
  return 0;
}

export type ContestRankInput = { entryId: string } & CombinedScore;

/**
 * Peringkat Contest. Hanya peserta dengan `score` yang diberi peringkat. Nilai tertinggi menang;
 * seri diputus `tieBreak`; yang masih sama berbagi peringkat dan peringkat berikutnya melompat
 * (1, 1, 3). Mengembalikan entryId -> peringkat.
 */
export function rankContest(
  inputs: readonly ContestRankInput[],
): Map<string, number> {
  const scored = inputs
    .filter((input) => input.score !== null)
    .sort(
      (a, b) =>
        (b.score as number) - (a.score as number) ||
        compareTieBreak(b.tieBreak, a.tieBreak),
    );
  const ranks = new Map<string, number>();
  scored.forEach((input, index) => {
    const previous = scored[index - 1];
    const tied =
      previous !== undefined &&
      previous.score === input.score &&
      compareTieBreak(previous.tieBreak, input.tieBreak) === 0;
    ranks.set(
      input.entryId,
      tied ? (ranks.get(previous.entryId) as number) : index + 1,
    );
  });
  return ranks;
}
