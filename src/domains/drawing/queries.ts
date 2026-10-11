import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timetrialKeys } from "@/domains/timetrial/keys";
import { getDrawing, lockDrawing, swapDrawing } from "./api";
import { drawingKeys } from "./keys";

export { drawingKeys };

/** Drawing satu kompetisi. `enabled=false` untuk tipe selain Race dan Time trial (tidak ada datanya). */
export function useDrawing(competitionId: string, enabled = true) {
  return useQuery({
    queryKey: drawingKeys.forCompetition(competitionId),
    queryFn: () => getDrawing(competitionId),
    enabled,
  });
}

/**
 * Lock: kirim seluruh susunan match (array entry id per match). Jawaban API (drawing terkunci
 * beserta `actions`) langsung menggantikan cache. Tidak ada cache kompetisi/entry yang berubah.
 */
export function useLockDrawing(competitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (matches: readonly (readonly string[])[]) =>
      lockDrawing(competitionId, matches),
    onSuccess: (data) => {
      client.setQueryData(drawingKeys.forCompetition(competitionId), data);
      // Time trial: antreannya baru ada setelah Lock.
      return client.invalidateQueries({
        queryKey: timetrialKeys.queue(competitionId),
      });
    },
  });
}

/** Swap dua peserta setelah Lock; jawaban API menggantikan cache. Gagal tetap menyegarkan cache. */
export function useSwapDrawing(competitionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { entryIdA: string; entryIdB: string }) =>
      swapDrawing(competitionId, v.entryIdA, v.entryIdB),
    onSuccess: (data) => {
      client.setQueryData(drawingKeys.forCompetition(competitionId), data);
      // Time trial: urutan antrean ikut berubah.
      return client.invalidateQueries({
        queryKey: timetrialKeys.queue(competitionId),
      });
    },
    onError: () =>
      client.invalidateQueries({
        queryKey: drawingKeys.forCompetition(competitionId),
      }),
  });
}
