import type {
  SortDirection,
  UserListQuery,
  UserSort,
  UserStatus,
} from "./types";

/**
 * Status filter di layar list user (kolom filter, urutan, halaman) dan terjemahannya ke
 * query server. Logika murni, tanpa React. Pola sama dengan `domains/events/list-state.ts`.
 */

/** Filter per kolom di baris filter tabel. String kosong = filter tidak aktif. */
export type UserColumnFilters = {
  /** Kolom User: nama atau username (dikirim sebagai `q`). */
  name: string;
  email: string;
  phone: string;
  city: string;
  /** Kode role, "" = semua. */
  role: string;
  status: UserStatus | "";
};

export const EMPTY_USER_FILTERS: UserColumnFilters = {
  name: "",
  email: "",
  phone: "",
  city: "",
  role: "",
  status: "",
};

/** Seluruh status layar list. `page` mulai dari 1. */
export type UserListState = {
  filters: UserColumnFilters;
  sort: UserSort;
  direction: SortDirection;
  page: number;
  perPage: number;
};

export const DEFAULT_PER_PAGE = 8;
export const PER_PAGE_OPTIONS = [8, 16, 32];

export const INITIAL_USER_LIST_STATE: UserListState = {
  filters: EMPTY_USER_FILTERS,
  sort: "name",
  direction: "asc",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

/** Teks filter yang sudah di-debounce oleh pemanggil (hook `useDebouncedValue`). */
export type DebouncedUserFilters = {
  name: string;
  email: string;
  phone: string;
  city: string;
};

/**
 * Status layar -> `UserListQuery` untuk `useUsers`. Teks kosong menjadi `undefined`
 * supaya tidak ikut terkirim. Teks dipakai dari `debounced`, bukan dari `state`, supaya
 * server tidak ditembak di tiap ketikan.
 */
export function buildUserListQuery(
  state: UserListState,
  debounced: DebouncedUserFilters,
): UserListQuery {
  const { filters } = state;
  return {
    q: debounced.name.trim() || undefined,
    email: debounced.email.trim() || undefined,
    phone: debounced.phone.trim() || undefined,
    city: debounced.city.trim() || undefined,
    role: filters.role || undefined,
    status: filters.status || undefined,
    sort: state.sort,
    direction: state.direction,
    page: state.page,
    perPage: state.perPage,
  };
}

/** True bila ada filter yang aktif (untuk pesan "tidak ada hasil" dan tombol clear). */
export function hasActiveUserFilters(filters: UserColumnFilters): boolean {
  return Boolean(
    filters.name.trim() ||
    filters.email.trim() ||
    filters.phone.trim() ||
    filters.city.trim() ||
    filters.role ||
    filters.status,
  );
}

/**
 * Klik judul kolom: kolom yang sama membalik arah, kolom baru mulai dari naik (A ke Z).
 * Mengembalikan pasangan sort + arah yang baru.
 */
export function nextUserSort(
  current: { sort: UserSort; direction: SortDirection },
  clicked: UserSort,
): { sort: UserSort; direction: SortDirection } {
  if (current.sort !== clicked) return { sort: clicked, direction: "asc" };
  return {
    sort: clicked,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}
