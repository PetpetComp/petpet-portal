/**
 * Selama endpoint Time trial yang baru (antrean `GET /competitions/{uuid}/queue`, skip, dan
 * pelengkap lain) belum ada di backend asli, layar Live Time trial menampilkan banner kuning
 * "Mock data". Satu-satunya tempat untuk mematikannya: ubah konstanta ini menjadi `false`
 * setelah backend punya endpoint-nya.
 */
export const TIMETRIAL_API_IS_MOCK = true;

export const TIMETRIAL_MOCK_BANNER =
  "Mock data - the time trial API is not fully built yet. Layout follows the agreed contract.";

/** Pesan untuk tipe kompetisi selain Time trial. */
export const TIMETRIAL_UNSUPPORTED_MESSAGE =
  "Time trial running is only available for Time trial competitions";

/** Jumlah baris bawaan panel "Best times so far" (desain menampilkan tiga). */
export const BEST_TIMES_PANEL_SIZE = 3;

/** Jumlah peserta bawaan di panel "Up next". */
export const UP_NEXT_SIZE = 1;

/** Jatah attempt bawaan bila rule kompetisi belum mengisinya (sama dengan bawaan backend). */
export const DEFAULT_ATTEMPT_LIMIT = 1;

/** Nilai `finish_status` timer result untuk attempt yang selesai dengan baik. */
export const FINISHED_RESULT_STATUS = "FINISHED";

/**
 * Kode `competition_types.code` yang dijalankan layar ini. Dipakai layar untuk memilih antara
 * Run Match (RACE) dan Time trial.
 */
export const TIMETRIAL_TYPE_CODE = "TIME_TRIAL";
