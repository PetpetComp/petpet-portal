/**
 * Selama endpoint hasil belum ada di backend asli, tab Results menampilkan banner kuning
 * "Mock data". Satu-satunya tempat untuk mematikannya: ubah konstanta ini menjadi `false`
 * setelah backend punya `GET /competitions/{uuid}/results`.
 */
export const RESULTS_API_IS_MOCK = true;

export const RESULTS_MOCK_BANNER =
  "Mock data - the results API is not built yet. Layout follows the agreed contract.";

/** Pesan untuk tipe kompetisi selain Race (keputusan D13: aturan gabung nilai belum ada). */
export const RESULTS_UNSUPPORTED_MESSAGE =
  "Results for this type are not available yet";
