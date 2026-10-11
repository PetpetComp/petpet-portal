import { useQuery } from "@tanstack/react-query";
import { getEventReport, getReportsOverview } from "./api";

export const reportKeys = {
  all: ["reports"] as const,
  event: (eventId: string) => [...reportKeys.all, "event", eventId] as const,
  overview: () => [...reportKeys.all, "overview"] as const,
};

/** Laporan satu event (tab Reports). */
export function useEventReport(eventId: string) {
  return useQuery({
    queryKey: reportKeys.event(eventId),
    queryFn: () => getEventReport(eventId),
  });
}

/** Ringkasan lintas event (halaman Reports). */
export function useReportsOverview() {
  return useQuery({
    queryKey: reportKeys.overview(),
    queryFn: getReportsOverview,
  });
}
