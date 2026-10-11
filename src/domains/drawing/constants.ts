/**
 * Selama endpoint drawing belum ada di backend asli, layar Drawing menampilkan banner kuning
 * "Mock data". Satu-satunya tempat untuk mematikannya: ubah konstanta ini menjadi `false`
 * setelah backend punya `GET/POST /competitions/{uuid}/drawing`.
 */
export const DRAWING_API_IS_MOCK = true;

export const DRAWING_MOCK_BANNER =
  "Mock data - the drawing API is not built yet. Layout follows the agreed contract.";

/** Pesan untuk tipe kompetisi yang tidak punya drawing (selain Race dan Time trial). */
export const DRAWING_UNSUPPORTED_MESSAGE =
  "Drawing is only available for Race and Time trial competitions";

/** Kode tipe kompetisi (`competition_types.code`) yang boleh diundi. */
export const DRAWABLE_TYPE_CODES = ["RACE", "TIME_TRIAL"] as const;

/** True bila tipe kompetisi punya drawing. Dipanggil dari layar Drawing dan Live. */
export function isDrawableType(code: string | null | undefined): boolean {
  return (DRAWABLE_TYPE_CODES as readonly string[]).includes(code ?? "");
}

/**
 * True bila drawing tipe ini berupa SATU antrean berurutan (Time trial): satu match yang
 * "lane"-nya adalah posisi antrean 1..N, bukan lintasan paralel seperti Race.
 */
export function isQueueType(code: string | null | undefined): boolean {
  return code === "TIME_TRIAL";
}
