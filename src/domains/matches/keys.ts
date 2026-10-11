/**
 * Key cache Run Match. Dipisah dari queries.ts supaya domain lain (mis. drawing atau
 * competitions) bisa menghapus cache match tanpa impor melingkar.
 */
export const matchKeys = {
  all: ["matches"] as const,
  /** Awalan semua daftar match; dipakai untuk invalidate sekaligus. */
  lists: () => [...matchKeys.all, "list"] as const,
  list: (competitionId: string) =>
    [...matchKeys.lists(), competitionId] as const,
  detail: (matchId: string) => [...matchKeys.all, "detail", matchId] as const,
};
