/**
 * Selama endpoint drawing belum ada di backend asli, layar Drawing menampilkan banner kuning
 * "Mock data". Satu-satunya tempat untuk mematikannya: ubah konstanta ini menjadi `false`
 * setelah backend punya `GET/POST /competitions/{uuid}/drawing`.
 */
export const DRAWING_API_IS_MOCK = true;

export const DRAWING_MOCK_BANNER =
  "Mock data - the drawing API is not built yet. Layout follows the agreed contract.";

/** Pesan untuk tipe kompetisi selain Race. */
export const DRAWING_UNSUPPORTED_MESSAGE =
  "Drawing is only available for Race competitions";
