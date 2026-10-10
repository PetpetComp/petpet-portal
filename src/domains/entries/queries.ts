import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { competitionKeys } from "@/domains/competitions/queries";
import {
  approveEntry,
  checkInEntry,
  createEntry,
  listEventEntries,
  rejectEntry,
  searchOwners,
  undoCheckIn,
} from "./api";
import type { EntryListQuery } from "./types";

export const entryKeys = {
  all: ["entries"] as const,
  forEvent: (eventId: string) => [...entryKeys.all, "event", eventId] as const,
  list: (eventId: string, query: EntryListQuery) =>
    [...entryKeys.forEvent(eventId), "list", query] as const,
  owners: (eventId: string, q: string) => ["owner-search", eventId, q] as const,
};

/** Shared by `useEventEntries` and imperative reads (QR scan) so both hit one cache entry. */
export const eventEntriesOptions = (eventId: string, query: EntryListQuery) =>
  queryOptions({
    queryKey: entryKeys.list(eventId, query),
    queryFn: () => listEventEntries(eventId, query),
  });

/** One server page; keeps the previous page on screen while the next one loads. */
export function useEventEntries(
  eventId: string,
  query: EntryListQuery,
  enabled = true,
) {
  return useQuery({
    ...eventEntriesOptions(eventId, query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInvalidateEntries(eventId: string) {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({ queryKey: entryKeys.forEvent(eventId) });
}

export function useReviewEntry(eventId: string) {
  const invalidate = useInvalidateEntries(eventId);
  return useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: "approve" | "reject";
    }) => (decision === "approve" ? approveEntry(id) : rejectEntry(id)),
    onSettled: invalidate,
  });
}

export function useCheckIn(eventId: string) {
  const invalidate = useInvalidateEntries(eventId);
  return useMutation({
    mutationFn: (id: string) => checkInEntry(id),
    onSettled: invalidate,
  });
}

export function useUndoCheckIn(eventId: string) {
  const invalidate = useInvalidateEntries(eventId);
  return useMutation({
    mutationFn: (id: string) => undoCheckIn(id),
    onSettled: invalidate,
  });
}

/** Also refreshes competitions: a new entry can fill one up (`registration_open`). */
export function useCreateEntry(eventId: string) {
  const client = useQueryClient();
  const invalidate = useInvalidateEntries(eventId);
  return useMutation({
    mutationFn: (v: { competitionId: string; petId: string }) =>
      createEntry(v.competitionId, { pet_id: v.petId }),
    onSuccess: () =>
      Promise.all([
        invalidate(),
        client.invalidateQueries({
          queryKey: competitionKeys.forEvent(eventId),
        }),
      ]),
  });
}

/** Starts searching from two characters, like the PIC search in the design. */
export function useOwnerSearch(eventId: string, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: entryKeys.owners(eventId, term),
    queryFn: () => searchOwners(eventId, term),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}
