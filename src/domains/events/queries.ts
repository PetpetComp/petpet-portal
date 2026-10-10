import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  cancelEvent,
  countEventEntries,
  countEventStaff,
  createEventWithPic,
  getEvent,
  getEventSponsorLevels,
  listEvents,
  publishEvent,
  updateEvent,
} from "./api";
import type { EventDetails } from "./schema";
import type { EventListQuery } from "./types";

export const eventKeys = {
  all: ["events"] as const,
  list: (query: EventListQuery) => [...eventKeys.all, "list", query] as const,
  detail: (id: string) => [...eventKeys.all, "detail", id] as const,
  counts: (id: string) => [...eventKeys.all, "counts", id] as const,
};

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => getEvent(id),
  });
}

/** Satu halaman list event dari server. Halaman lama tetap tampil selama halaman baru dimuat. */
export function useEvents(query: EventListQuery) {
  return useQuery({
    queryKey: eventKeys.list(query),
    queryFn: () => listEvents(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * Jumlah panitia event untuk checklist Setup. Query terpisah dari sponsor dan entry
 * karena tiap endpoint punya aturan akses sendiri: satu boleh gagal, yang lain tetap jalan.
 */
export function useEventStaffCount(id: string) {
  return useQuery({
    queryKey: [...eventKeys.counts(id), "staff"],
    queryFn: () => countEventStaff(id),
  });
}

/** Total sponsor dan rinciannya per level (tab Sponsors, kartu Sponsors, checklist). */
export function useEventSponsors(id: string) {
  return useQuery({
    queryKey: [...eventKeys.counts(id), "sponsors"],
    queryFn: () => getEventSponsorLevels(id),
  });
}

/** Total entry semua kompetisi event (hitungan tab Participants dan kartu Participants). */
export function useEventEntryCount(id: string) {
  return useQuery({
    queryKey: [...eventKeys.counts(id), "entries"],
    queryFn: () => countEventEntries(id),
  });
}

/**
 * Jumlah entry per kompetisi untuk bar "Participants per competition".
 * Satu request kecil per kompetisi (backend belum punya `entries_count`, docs 09 bagian G).
 * Hasilnya `Record<competitionId, jumlah>`; kompetisi yang gagal dimuat tidak ada di record.
 */
export function useCompetitionEntryCounts(
  eventId: string,
  competitionIds: string[],
) {
  return useQueries({
    queries: competitionIds.map((competitionId) => ({
      queryKey: [...eventKeys.counts(eventId), "entries", competitionId],
      queryFn: () => countEventEntries(eventId, competitionId),
    })),
    combine: (results) => ({
      counts: Object.fromEntries(
        competitionIds.flatMap((id, i) =>
          results[i]?.data === undefined ? [] : [[id, results[i].data]],
        ),
      ) as Record<string, number>,
      isPending: results.some((r) => r.isPending),
    }),
  });
}

/** Buat event + undang PIC. Setelah berhasil, semua list dan detail event dimuat ulang. */
export function useCreateEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createEventWithPic,
    onSuccess: () => client.invalidateQueries({ queryKey: eventKeys.all }),
  });
}

/** Simpan perubahan Edit event. */
export function useUpdateEvent(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (details: EventDetails) => updateEvent(id, details),
    onSuccess: () => client.invalidateQueries({ queryKey: eventKeys.all }),
  });
}

/** Terbitkan event Draft. */
export function usePublishEvent(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => publishEvent(id),
    onSuccess: () => client.invalidateQueries({ queryKey: eventKeys.all }),
  });
}

/** Batalkan event (di backend: `DELETE`, status menjadi CANCELLED). */
export function useCancelEvent(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => cancelEvent(id),
    onSuccess: () => client.invalidateQueries({ queryKey: eventKeys.all }),
  });
}

/**
 * Event untuk halaman Home: 100 pertama, disaring di browser karena API belum punya
 * filter tanggal (docs 09 bagian F). Mengembalikan `{ items, total }` seperti sebelumnya.
 */
export function useHomeEvents(enabled: boolean) {
  return useQuery({
    queryKey: [...eventKeys.all, "home"],
    queryFn: async () => {
      const page = await listEvents({ page: 1, perPage: 100 });
      return { items: page.items, total: page.meta.total };
    },
    enabled,
  });
}
