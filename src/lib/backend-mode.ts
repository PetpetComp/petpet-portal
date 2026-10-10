/**
 * Apakah portal sedang memakai backend palsu (`NEXT_PUBLIC_USE_MOCK_BACKEND=true`).
 *
 * Dipakai untuk fitur layar yang kontraknya sudah ditulis tapi backend aslinya belum
 * mendukung (contoh: filter per kolom di list event, lihat docs 09 dan 13). Di mode
 * backend asli fitur itu disembunyikan supaya UI tidak berbohong; di mode mock tetap aktif.
 * Dibaca dari komponen/hook lewat konstanta ini, bukan lewat `process.env` langsung.
 */
export const USING_MOCK_BACKEND =
  process.env.NEXT_PUBLIC_USE_MOCK_BACKEND === "true";
