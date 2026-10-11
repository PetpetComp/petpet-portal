/**
 * Selama endpoint Judging yang baru (`GET /competitions/{uuid}/judging`, antrean juri) belum ada
 * di backend asli, layar Live Judging menampilkan banner kuning "Mock data". Satu-satunya tempat
 * untuk mematikannya: ubah konstanta ini menjadi `false` setelah backend punya endpoint-nya.
 */
export const JUDGING_API_IS_MOCK = true;

export const JUDGING_MOCK_BANNER =
  "Mock data - the judging API is not fully built yet. Layout follows the agreed contract.";

/** Pesan untuk tipe kompetisi yang bukan Contest. */
export const JUDGING_UNSUPPORTED_MESSAGE =
  "Judging is only available for Contest competitions (Beauty and Best in Show)";

/**
 * Kode `competition_types.code` yang dinilai juri (result_mode JUDGED_SCORE atau COMBINED).
 * Dipakai layar untuk memilih antara Run Match, Time trial, dan Judging.
 */
export const JUDGING_TYPE_CODES = ["BEAUTY", "BEST_IN_SHOW"] as const;

/** Skor total tampilan selalu 0 sampai angka ini (lihat `weightedTotal`). */
export const TOTAL_SCORE_MAX = 100;

/**
 * Saran jeda debounce autosave untuk layar (tahap 2): skor disimpan setelah juri berhenti
 * menggeser selama sekian milidetik, bukan di setiap pixel gerakan slider.
 */
export const AUTOSAVE_DEBOUNCE_MS = 600;
