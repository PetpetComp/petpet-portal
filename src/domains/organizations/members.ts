import type { MemberRole, OrganizationMember } from "./types";

/**
 * Filter dan paging daftar anggota di browser. Logika murni, tanpa React.
 *
 * Kenapa di browser: `GET /organizations/{uuid}/members` mengirim SELURUH anggota (array datar,
 * bukan halaman), jadi menyaring di sini tetap benar dan tidak menyesatkan seperti menyaring
 * satu halaman dari server (docs 08 bagian 9.3). Kalau backend nanti membuat halaman dan filter
 * sendiri, hanya `queries.ts` dan file ini yang berubah.
 */

/** Filter kolom di baris filter tabel Members. String kosong = filter tidak aktif. */
export type MemberFilters = {
  name: string;
  email: string;
  role: MemberRole | "";
};

export const EMPTY_MEMBER_FILTERS: MemberFilters = {
  name: "",
  email: "",
  role: "",
};

/** Jumlah baris per halaman yang ditawarkan (desain memakai 10). */
export const MEMBER_PER_PAGE_OPTIONS = [10, 20, 50];
export const DEFAULT_MEMBER_PER_PAGE = 10;

/** True bila ada filter yang aktif (untuk pesan "tidak ada hasil" dan tombol clear). */
export function hasMemberFilters(filters: MemberFilters): boolean {
  return Boolean(filters.name.trim() || filters.email.trim() || filters.role);
}

/** Cocok sebagian, tanpa membedakan huruf besar/kecil. Teks pencarian kosong selalu cocok. */
function contains(text: string | null, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (text ?? "").toLowerCase().includes(needle);
}

/**
 * Anggota yang cocok dengan semua filter aktif. Anggota tanpa email (backend belum mengirim)
 * tidak cocok dengan filter email yang terisi. Dipanggil dari tab Members.
 */
export function filterMembers(
  members: OrganizationMember[],
  filters: MemberFilters,
): OrganizationMember[] {
  return members.filter(
    (m) =>
      contains(m.name, filters.name) &&
      contains(m.email, filters.email) &&
      (!filters.role || m.role === filters.role),
  );
}

/**
 * Anggota dengan email yang sama (tanpa membedakan huruf besar/kecil), atau undefined.
 * Dipakai drawer undang untuk menolak mengundang orang yang sudah anggota. Anggota tanpa
 * email (backend belum mengirim) tidak bisa dicocokkan di sini.
 */
export function findMemberByEmail(
  members: OrganizationMember[],
  email: string,
): OrganizationMember | undefined {
  const needle = email.trim().toLowerCase();
  if (!needle) return undefined;
  return members.find((m) => m.email?.toLowerCase() === needle);
}

/** Potongan satu halaman (nomor halaman mulai dari 1; di luar jangkauan dijepit ke halaman terakhir). */
export function pageOf<T>(items: T[], page: number, perPage: number): T[] {
  const last = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), last);
  const start = (current - 1) * perPage;
  return items.slice(start, start + perPage);
}
