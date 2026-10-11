/**
 * Key cache Judging. Dipisah dari queries.ts supaya domain lain bisa menghapus cache tanpa
 * impor melingkar.
 */
export const judgingKeys = {
  all: ["judging"] as const,
  /** Kriteria, antrean peserta, dan scorecard milik pemanggil untuk satu kompetisi. */
  forCompetition: (competitionId: string) =>
    [...judgingKeys.all, "competition", competitionId] as const,
};
