/**
 * Key cache Time trial. Dipisah dari queries.ts supaya domain lain (mis. drawing atau
 * competitions) bisa menghapus cache antrean tanpa impor melingkar.
 */
export const timetrialKeys = {
  all: ["timetrial"] as const,
  /** Antrean satu kompetisi (peserta, attempt, waktu terbaik, `actions`). */
  queue: (competitionId: string) =>
    [...timetrialKeys.all, "queue", competitionId] as const,
};
