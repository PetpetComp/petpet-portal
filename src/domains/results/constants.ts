/**
 * Selama endpoint hasil belum ada di backend asli, tab Results menampilkan banner kuning
 * "Mock data". Satu-satunya tempat untuk mematikannya: ubah konstanta ini menjadi `false`
 * setelah backend punya `GET /competitions/{uuid}/results`.
 */
export const RESULTS_API_IS_MOCK = true;

export const RESULTS_MOCK_BANNER =
  "Mock data - the results API is not built yet. Layout follows the agreed contract.";

/**
 * Kode tipe kompetisi yang punya klasemen: Race, Time trial (waktu terbaik), dan Contest
 * (nilai gabungan juri). Checkpoint menyusul bersama penalti waktu (P5b).
 */
export const RESULT_TYPE_CODES = [
  "RACE",
  "TIME_TRIAL",
  "BEAUTY",
  "BEST_IN_SHOW",
] as const;

/** Teks kosong per jenis klasemen. */
export const RESULTS_EMPTY_MESSAGE = {
  RACE: "No results yet. The ranking appears here once the race has finished.",
  TIME_TRIAL:
    "No results yet. The ranking appears here once a participant has a finished attempt.",
  CONTEST:
    "No results yet. The ranking appears here once judges have locked their scorecards.",
} as const;

/** Pesan untuk tipe kompetisi yang belum punya klasemen (Checkpoint). */
export const RESULTS_UNSUPPORTED_MESSAGE =
  "Results for this type are not available yet";
