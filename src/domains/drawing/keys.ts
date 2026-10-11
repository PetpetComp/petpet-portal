/**
 * Key cache drawing. Dipisah dari queries.ts supaya domain competitions bisa menghapus cache
 * drawing (saat registrasi dibuka lagi) tanpa import melingkar.
 */
export const drawingKeys = {
  all: ["drawing"] as const,
  forCompetition: (id: string) => [...drawingKeys.all, id] as const,
};
