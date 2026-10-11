import type { BrandListQuery } from "./types";

/**
 * Status layar daftar brand (pencarian dan halaman) dan terjemahannya ke query server.
 * Logika murni, tanpa React. Dipakai oleh `BrandsPage`.
 */

export const DEFAULT_PER_PAGE = 8;
export const PER_PAGE_OPTIONS = [8, 16, 32];

/** Seluruh status layar daftar. `page` mulai dari 1. */
export type BrandListState = {
  search: string;
  page: number;
  perPage: number;
};

export const INITIAL_LIST_STATE: BrandListState = {
  search: "",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

/**
 * Status layar -> `BrandListQuery` untuk `useBrandPage`. `search` diberikan terpisah karena
 * pemanggil mengirim nilai yang sudah di-debounce. Teks kosong menjadi `undefined`.
 */
export function buildBrandListQuery(
  state: BrandListState,
  debouncedSearch: string,
): BrandListQuery {
  return {
    q: debouncedSearch.trim() || undefined,
    page: state.page,
    perPage: state.perPage,
  };
}

/** True bila pencarian aktif (untuk memilih pesan "tidak ada hasil" vs "belum ada brand"). */
export const hasActiveSearch = (state: BrandListState) =>
  state.search.trim().length > 0;
