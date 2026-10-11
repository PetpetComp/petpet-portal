/**
 * Selama endpoint Reports belum ada di backend asli, halaman menampilkan banner kuning
 * "Mock data". Satu-satunya tempat untuk mematikannya: ubah konstanta ini menjadi `false`
 * setelah backend punya `GET /events/{uuid}/report` dan `GET /reports/overview`.
 */
export const REPORTS_API_IS_MOCK = true;

export const REPORTS_MOCK_BANNER =
  "Mock data - the reports API is not built yet. Layout follows the agreed contract.";
