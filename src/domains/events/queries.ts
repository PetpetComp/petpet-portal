import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  countEventSponsors,
  countEventStaff,
  deleteEvent,
  getEvent,
  listEvents,
  organizationNames,
} from "./api";

export const eventKeys = {
  all: ["events"] as const,
  list: (page: number, perPage: number) =>
    [...eventKeys.all, "list", { page, perPage }] as const,
  detail: (id: string) => [...eventKeys.all, "detail", id] as const,
  counts: (id: string) => [...eventKeys.all, "counts", id] as const,
  organizerNames: ["organizations", "names"] as const,
};

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => getEvent(id),
  });
}

/**
 * Committee and sponsor totals for the overview. Two queries on purpose:
 * each endpoint has its own access rule, so one may fail while the other works.
 */
export function useEventStaffCount(id: string) {
  return useQuery({
    queryKey: [...eventKeys.counts(id), "staff"],
    queryFn: () => countEventStaff(id),
  });
}

export function useEventSponsorCount(id: string) {
  return useQuery({
    queryKey: [...eventKeys.counts(id), "sponsors"],
    queryFn: () => countEventSponsors(id),
  });
}

/** `page` is 1-based, like the API. Keeps the previous page on screen while the next one loads. */
export function useEvents(page: number, perPage: number) {
  return useQuery({
    queryKey: eventKeys.list(page, perPage),
    queryFn: () => listEvents({ page, perPage }),
    placeholderData: keepPreviousData,
  });
}

export function useOrganizerNames() {
  return useQuery({
    queryKey: eventKeys.organizerNames,
    queryFn: organizationNames,
    staleTime: 5 * 60_000,
  });
}

export function useDeleteEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => client.invalidateQueries({ queryKey: eventKeys.all }),
  });
}
