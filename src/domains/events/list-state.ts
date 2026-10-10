import type {
  EventListQuery,
  EventPhase,
  EventSort,
  SortDirection,
} from "./types";

/**
 * Status filter di layar list event (tab, kolom filter, pencarian, urutan, halaman),
 * dan terjemahannya ke query server. Logika murni, tanpa React.
 */

/** Filter per kolom di baris filter tabel. String kosong = filter tidak aktif. */
export type EventColumnFilters = {
  name: string;
  month: string;
  venue: string;
  organizationId: string;
  phase: EventPhase | "";
};

export const EMPTY_COLUMN_FILTERS: EventColumnFilters = {
  name: "",
  month: "",
  venue: "",
  organizationId: "",
  phase: "",
};

/** Seluruh status layar list. `page` mulai dari 1. */
export type EventListState = {
  filters: EventColumnFilters;
  search: string;
  sort: EventSort;
  direction: SortDirection;
  page: number;
  perPage: number;
};

export const DEFAULT_PER_PAGE = 8;
export const PER_PAGE_OPTIONS = [8, 16, 32];

export const INITIAL_LIST_STATE: EventListState = {
  filters: EMPTY_COLUMN_FILTERS,
  search: "",
  sort: "start_at",
  direction: "desc",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

/**
 * Status layar -> `EventListQuery` untuk `useEvents`. Teks kosong menjadi `undefined`
 * supaya tidak ikut terkirim. `search` diberikan terpisah karena pemanggil
 * mengirim nilai yang sudah di-debounce.
 */
export function buildEventListQuery(
  state: EventListState,
  debounced: { search: string; name: string; venue: string },
): EventListQuery {
  const { filters } = state;
  return {
    phase: filters.phase || undefined,
    q: debounced.search.trim() || undefined,
    name: debounced.name.trim() || undefined,
    venue: debounced.venue.trim() || undefined,
    month: filters.month || undefined,
    organizationId: filters.organizationId || undefined,
    sort: state.sort,
    direction: state.direction,
    page: state.page,
    perPage: state.perPage,
  };
}

/** True bila ada filter kolom atau pencarian yang aktif (untuk pesan "tidak ada hasil" dan tombol clear). */
export function hasActiveFilters(state: EventListState): boolean {
  const f = state.filters;
  return Boolean(
    state.search.trim() ||
    f.name.trim() ||
    f.month ||
    f.venue.trim() ||
    f.organizationId ||
    f.phase,
  );
}
