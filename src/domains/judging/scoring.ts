/**
 * Logika murni penilaian juri (tanpa jaringan dan tanpa React), supaya mudah dites dan dipakai
 * layar maupun mock. Aturan yang SAH tetap di backend/mock (validasi, izin, `actions`); fungsi di
 * sini hanya untuk tampilan: total langsung saat slider digeser, pesan per kriteria, langkah slider.
 */
import type { ScoreCriterion } from "@/domains/competitions/types";
import { TOTAL_SCORE_MAX } from "./constants";
import type { ScoreMap } from "./types";

/** Bagian kriteria yang dibutuhkan fungsi di bawah (sebagian dari `ScoreCriterion`). */
export type CriterionRule = Pick<
  ScoreCriterion,
  "id" | "name" | "weight" | "min" | "max" | "noteRequired"
>;

/** Pembulatan ke 1 desimal (dipakai total tampilan). */
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Membuang sisa pecahan biner (0.1 + 0.2) dengan membulatkan ke 6 desimal. */
const clean = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Menjepit nilai ke rentang kriteria [min, max]. Bukan angka (NaN) menjadi `min`.
 * Dipanggil dari `normalizeScore` dan layar saat juri mengetik angka.
 */
export function clampScore(
  criterion: Pick<CriterionRule, "min" | "max">,
  value: number,
): number {
  if (Number.isNaN(value)) return criterion.min;
  return Math.min(criterion.max, Math.max(criterion.min, value));
}

/**
 * Nilai satu kriteria sebagai persen 0 sampai 100 dari rentangnya: (score - min) / (max - min).
 * Contoh rentang 0 sampai 10, skor 7.5 -> 75. Rentang 5 sampai 10, skor 7.5 -> 50 (min bukan 0).
 * Rentang tidak valid (max <= min) -> 0. Hasil dijepit ke 0..100.
 */
export function scoreToPercent(
  criterion: Pick<CriterionRule, "min" | "max">,
  score: number,
): number {
  const range = criterion.max - criterion.min;
  if (!(range > 0)) return 0;
  const percent = ((score - criterion.min) / range) * 100;
  return Math.min(100, Math.max(0, percent));
}

/**
 * RUMUS TAMPILAN skor total (keputusan 2A): angka 0 sampai 100 yang sama untuk semua kriteria,
 * apa pun rentang dan bobotnya.
 *
 *   total = sum(persenKriteria * bobot) / sum(bobot)       persenKriteria = (score - min) / (max - min) * 100
 *
 * Contoh (bobot 40/30/30, rentang 0..10): skor 8, 6, 9 -> (80*40 + 60*30 + 90*30) / 100 = 77.
 * Bobot tidak harus berjumlah 100: bobot 2 dan 1 pada persen 100 dan 40 -> (200 + 40) / 3 = 80.
 *
 * Kriteria yang belum diisi dihitung 0 persen tetapi bobotnya TETAP ikut pembagi, jadi total
 * sementara tidak melonjak saat kriteria diisi satu per satu. Jumlah bobot 0 -> 0.
 * Hasil dibulatkan 1 desimal.
 *
 * CATATAN: backend sekarang menyimpan `weighted_total = sum(score * weight)` (angka mentah, bukan
 * 0..100; temuan D1). Layar TIDAK memakai angka itu.
 */
export function weightedTotal(
  criteria: readonly Pick<CriterionRule, "id" | "weight" | "min" | "max">[],
  scores: ScoreMap,
): number {
  let weightSum = 0;
  let weighted = 0;
  for (const criterion of criteria) {
    weightSum += criterion.weight;
    const score = scores[criterion.id]?.score;
    if (score === null || score === undefined) continue;
    weighted += scoreToPercent(criterion, score) * criterion.weight;
  }
  if (!(weightSum > 0)) return 0;
  return round1((weighted / weightSum) * (TOTAL_SCORE_MAX / 100));
}

/** Hasil `validateScorecard`. */
export type ScorecardValidation = {
  /** True bila tidak ada kesalahan: scorecard boleh di-submit. */
  valid: boolean;
  /** Pesan per id kriteria yang bermasalah (kosong bila valid). */
  errors: Record<string, string>;
  /** Id kriteria bermasalah pertama menurut urutan `criteria`; null bila valid. */
  firstInvalidId: string | null;
};

/**
 * Memeriksa scorecard sebelum Submit: setiap kriteria punya skor, skor dalam rentang, dan catatan
 * terisi (bukan hanya spasi) untuk kriteria `noteRequired`. Satu pesan per kriteria (skor lebih
 * dulu daripada catatan). Dipakai layar untuk menandai kriteria dan mock untuk menolak 422.
 */
export function validateScorecard(
  criteria: readonly CriterionRule[],
  scores: ScoreMap,
): ScorecardValidation {
  const errors: Record<string, string> = {};
  let firstInvalidId: string | null = null;
  for (const criterion of criteria) {
    const entry = scores[criterion.id];
    const score = entry?.score;
    let message: string | null = null;
    if (score === null || score === undefined || Number.isNaN(score)) {
      message = `Score is required for ${criterion.name}.`;
    } else if (score < criterion.min || score > criterion.max) {
      message = `Score for ${criterion.name} must be between ${criterion.min} and ${criterion.max}.`;
    } else if (criterion.noteRequired && !entry?.note.trim()) {
      message = `A note is required for ${criterion.name}.`;
    }
    if (message) {
      errors[criterion.id] = message;
      firstInvalidId ??= criterion.id;
    }
  }
  return { valid: firstInvalidId === null, errors, firstInvalidId };
}

/**
 * Langkah slider untuk satu kriteria (keputusan: tiga tingkat menurut lebar rentang):
 * - rentang >= 10 (mis. 0..10, 0..100): 1, bilangan bulat, cepat disentuh di ponsel;
 * - rentang di atas 1 sampai di bawah 10 (mis. 1..5): 0.5;
 * - rentang <= 1 (mis. 0..1): 0.1;
 * - rentang tidak valid: 1.
 */
export function sliderStep(
  criterion: Pick<CriterionRule, "min" | "max">,
): number {
  const range = criterion.max - criterion.min;
  if (!(range > 0)) return 1;
  if (range >= 10) return 1;
  if (range > 1) return 0.5;
  return 0.1;
}

/**
 * Membulatkan nilai ke kelipatan `sliderStep` dari `min`, lalu menjepit ke rentang.
 * Dipakai layar untuk nilai ketikan dan slider sebelum disimpan, supaya skor yang tersimpan
 * selalu rapi (7.5, bukan 7.4999999).
 */
export function normalizeScore(
  criterion: Pick<CriterionRule, "min" | "max">,
  value: number,
): number {
  const step = sliderStep(criterion);
  const snapped =
    criterion.min + Math.round((value - criterion.min) / step) * step;
  return clampScore(criterion, clean(snapped));
}
