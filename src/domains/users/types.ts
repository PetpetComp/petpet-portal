/**
 * Satu user dari `GET /users` (petpet-service `UserData::toArray`, bagian yang dipakai pencarian).
 * `is_member` BELUM dikirim backend asli: kontrak 13 bagian 1, hanya ada bila request
 * membawa `organization_id`. Mock sudah mengirimnya.
 */
export type ApiUserSummary = {
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  status: string;
  is_member?: boolean;
};

/** Hasil pencarian user untuk dipilih (mis. PIC event). Dibuat oleh `userHitFromApi`. */
export type UserHit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** True bila anggota organisasi yang dikirim saat mencari. */
  isMember: boolean;
};

/** Pencarian user: jumlah ditampilkan dibatasi, `total` = semua yang cocok. */
export type UserSearchResult = { items: UserHit[]; total: number };

/** Syarat backend: pencarian baru jalan dari 2 huruf (docs 08 bagian 9.1). */
export const USER_SEARCH_MIN_LENGTH = 2;
/** Maksimal hasil yang ditampilkan (docs 08 bagian 9.1). */
export const USER_SEARCH_LIMIT = 5;

/** Nama lengkap, atau username bila nama belakang kosong dan nama depan juga kosong. */
export function userHitFromApi(row: ApiUserSummary): UserHit {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return {
    id: row.uuid,
    name: name || row.username,
    email: row.email,
    phone: row.phone,
    isMember: row.is_member ?? false,
  };
}
