import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventKeys } from "@/domains/events/queries";
import {
  addEventSponsor,
  changeEventSponsorLevel,
  listBrands,
  listEventSponsorLinks,
  removeEventSponsor,
} from "./api";
import { joinSponsors } from "./types";

export const sponsorKeys = {
  all: ["sponsors"] as const,
  forEvent: (eventId: string) =>
    [...sponsorKeys.all, "event", eventId] as const,
  brands: () => [...sponsorKeys.all, "brands"] as const,
};

/** Tautan sponsor satu event (tanpa nama brand). */
export function useEventSponsorLinks(eventId: string) {
  return useQuery({
    queryKey: sponsorKeys.forEvent(eventId),
    queryFn: () => listEventSponsorLinks(eventId),
  });
}

/** Semua brand. Jarang berubah, jadi disegarkan paling cepat tiap semenit. */
export function useBrands() {
  return useQuery({
    queryKey: sponsorKeys.brands(),
    queryFn: listBrands,
    staleTime: 60_000,
  });
}

/**
 * Sponsor satu event yang sudah digabung dengan nama brand, untuk tab Sponsors.
 * `isLoading` benar selama salah satu dari dua daftar masih dimuat; `error` dari yang gagal.
 */
export function useEventSponsorTeam(eventId: string) {
  const links = useEventSponsorLinks(eventId);
  const brands = useBrands();
  const sponsors = useMemo(
    () =>
      links.data && brands.data
        ? joinSponsors(links.data, brands.data)
        : undefined,
    [links.data, brands.data],
  );
  return {
    links: links.data,
    brands: brands.data,
    sponsors,
    isLoading: links.isLoading || brands.isLoading,
    isError: links.isError || brands.isError,
    error: links.error ?? brands.error,
    refetch: () => {
      void links.refetch();
      void brands.refetch();
    },
  };
}

/** Setelah ubah sponsor: muat ulang daftar dan hitungan di Overview/tab (kartu Sponsors). */
function useRefreshSponsors(eventId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: sponsorKeys.forEvent(eventId) }),
      client.invalidateQueries({ queryKey: eventKeys.counts(eventId) }),
    ]);
}

export function useAddSponsor(eventId: string) {
  const refresh = useRefreshSponsors(eventId);
  return useMutation({
    mutationFn: (v: { brandId: string; level: string }) =>
      addEventSponsor(eventId, v.brandId, v.level),
    onSuccess: refresh,
  });
}

export function useRemoveSponsor(eventId: string) {
  const refresh = useRefreshSponsors(eventId);
  return useMutation({
    mutationFn: (linkId: string) => removeEventSponsor(eventId, linkId),
    onSettled: refresh,
  });
}

/** Ubah tier = hapus + buat ulang (lihat `changeEventSponsorLevel`). Daftar dimuat ulang apa pun hasilnya. */
export function useChangeSponsorLevel(eventId: string) {
  const refresh = useRefreshSponsors(eventId);
  return useMutation({
    mutationFn: (v: {
      link: { id: string; brandId: string; level: string };
      level: string;
    }) => changeEventSponsorLevel(eventId, v.link, v.level),
    onSettled: refresh,
  });
}
