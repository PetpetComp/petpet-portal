import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompetitionResults, verifyCompetitionResults } from "./api";

export const resultKeys = {
  all: ["results"] as const,
  forCompetition: (id: string) => [...resultKeys.all, id] as const,
};

/** Klasemen akhir. `enabled=false` untuk tipe kompetisi selain Race (tidak ada datanya). */
export function useCompetitionResults(id: string, enabled = true) {
  return useQuery({
    queryKey: resultKeys.forCompetition(id),
    queryFn: () => getCompetitionResults(id),
    enabled,
  });
}

/** Verifikasi hasil; jawaban API langsung menggantikan cache agar tombol ikut berubah. */
export function useVerifyResults(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => verifyCompetitionResults(id),
    onSuccess: (data) =>
      client.setQueryData(resultKeys.forCompetition(id), data),
  });
}
