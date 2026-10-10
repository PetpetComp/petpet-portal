import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEventCompetitions } from "@/domains/competitions/queries";
import {
  approveEntry,
  createEntry,
  listEventEntries,
  listOwnerPets,
  listPeriods,
  rejectEntry,
  searchOwners,
} from "./api";

export const entryKeys = {
  all: ["entries"] as const,
  forEvent: (eventId: string) => [...entryKeys.all, "event", eventId] as const,
  periods: (competitionId: string) => ["periods", competitionId] as const,
  owners: (q: string) => ["owners", q] as const,
  ownerPets: (ownerId: string) => ["pets", "owner", ownerId] as const,
};

/** Waits for the event's competitions, then loads their entries. */
export function useEventEntries(eventId: string) {
  const competitions = useEventCompetitions(eventId);
  const ids = (competitions.data ?? []).map((c) => c.id);
  const entries = useQuery({
    queryKey: [...entryKeys.forEvent(eventId), ids],
    queryFn: () => listEventEntries(ids),
    enabled: competitions.isSuccess,
  });
  return { competitions, entries };
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
    onSuccess: invalidate,
  });
}

export function useCreateEntry(eventId: string) {
  const invalidate = useInvalidateEntries(eventId);
  return useMutation({
    mutationFn: (v: {
      competitionId: string;
      petId: string;
      periodId?: string;
    }) =>
      createEntry(v.competitionId, {
        pet_id: v.petId,
        registration_period_id: v.periodId,
      }),
    onSuccess: invalidate,
  });
}

export function usePeriods(competitionId: string) {
  return useQuery({
    queryKey: entryKeys.periods(competitionId),
    queryFn: () => listPeriods(competitionId),
    enabled: !!competitionId,
  });
}

/** Starts searching from two characters, like the PIC search in the design. */
export function useOwnerSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: entryKeys.owners(term),
    queryFn: () => searchOwners(term),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });
}

export function useOwnerPets(ownerId: string) {
  return useQuery({
    queryKey: entryKeys.ownerPets(ownerId),
    queryFn: () => listOwnerPets(ownerId),
    enabled: !!ownerId,
  });
}
