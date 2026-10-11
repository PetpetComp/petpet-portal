/**
 * Fitur layar Pets yang kontraknya sudah ditulis tetapi backend aslinya belum mendukung
 * (doc 09 bagian P). Di mode backend asli fitur ini disembunyikan supaya UI tidak berbohong;
 * di mode mock semuanya aktif (doc 08 bagian 9.3, `lib/backend-mode.ts`).
 */
export type PetFeatures = {
  /** Kotak pencarian dan chip spesies di list: backend asli belum punya filter `q`/`species_id`. */
  serverFilters: boolean;
  /** Staf memilih pemilik saat membuat pet: backend asli selalu memakai pemanggil. */
  ownerPicker: boolean;
  /** Spesies dan morph boleh diubah di Edit: `UpdatePetRequest` backend asli tidak menerimanya. */
  editClassification: boolean;
};

/**
 * Menentukan fitur yang aktif.
 * `usingMockBackend` dari `USING_MOCK_BACKEND`; `canManageUsers` dari `can(USER_MANAGE)`.
 * Dipanggil dari komponen list dan form. Hanya menyembunyikan UI; backend tetap menegakkan hak.
 */
export function petFeatures(
  usingMockBackend: boolean,
  canManageUsers: boolean,
): PetFeatures {
  return {
    serverFilters: usingMockBackend,
    ownerPicker: usingMockBackend && canManageUsers,
    editClassification: usingMockBackend,
  };
}
