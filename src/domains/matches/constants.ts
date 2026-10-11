/**
 * Selama endpoint Run Match yang baru (daftar match, detail match, confirm) belum ada di backend
 * asli, layar Live Matches menampilkan banner kuning "Mock data". Satu-satunya tempat untuk
 * mematikannya: ubah konstanta ini menjadi `false` setelah backend punya endpoint-nya.
 */
export const MATCHES_API_IS_MOCK = true;

export const MATCHES_MOCK_BANNER =
  "Mock data - the run match API is not fully built yet. Layout follows the agreed contract.";

/** Cut-off bawaan (ms) bila rule kompetisi tidak punya `time_limit_ms`. Sama dengan nilai mock. */
export const DEFAULT_CUTOFF_MS = 600000;

/** Hitung mundur bawaan (detik) bila rule tidak mengisinya; sama dengan bawaan backend. */
export const DEFAULT_COUNTDOWN_SECONDS = 3;

/** Alasan wajib saat Disqualify (isi `reason` penalti). Layar boleh menawarkan pilihan ini. */
export const DISQUALIFY_REASONS = [
  "False start",
  "Left the lane",
  "Interfered with another participant",
  "Handler broke the rules",
] as const;

/** Nilai `penalty_type` untuk Disqualify. */
export const DISQUALIFY_PENALTY_TYPE = "DISQUALIFICATION";

/** Pesan untuk tipe kompetisi selain Race. */
export const MATCHES_UNSUPPORTED_MESSAGE =
  "Run match is only available for Race competitions";
