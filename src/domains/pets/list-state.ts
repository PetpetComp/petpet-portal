import type { PetListQuery } from "./types";

/**
 * Status filter di layar list pet (pencarian, chip spesies, halaman),
 * dan terjemahannya ke query server. Logika murni, tanpa React.
 */

/** Seluruh status layar list. `speciesId` kosong = chip "All". `page` mulai dari 1. */
export type PetListState = {
  search: string;
  speciesId: string;
  page: number;
  perPage: number;
};

export const DEFAULT_PER_PAGE = 8;
export const PER_PAGE_OPTIONS = [8, 16, 32];

export const INITIAL_LIST_STATE: PetListState = {
  search: "",
  speciesId: "",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

/**
 * Status layar -> `PetListQuery` untuk `usePetList`. Teks kosong menjadi `undefined` supaya
 * tidak terkirim. `search` diberikan terpisah karena pemanggil mengirim nilai yang sudah di-debounce.
 * Urutan bawaan: nama A-Z (desain tidak punya kontrol urutan).
 */
export function buildPetListQuery(
  state: PetListState,
  debouncedSearch: string,
): PetListQuery {
  return {
    q: debouncedSearch.trim() || undefined,
    speciesId: state.speciesId || undefined,
    sort: "name",
    direction: "asc",
    page: state.page,
    perPage: state.perPage,
  };
}

/** True bila pencarian atau chip spesies aktif (untuk pesan "tidak ada hasil" vs "belum ada pet"). */
export function hasActiveFilters(state: PetListState): boolean {
  return Boolean(state.search.trim() || state.speciesId);
}
