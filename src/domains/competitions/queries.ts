import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompetition,
  listCompetitionTypes,
  listEventCompetitions,
  listSpecies,
} from "./api";
import type { NewCompetition } from "./schema";

export const competitionKeys = {
  all: ["competitions"] as const,
  forEvent: (eventId: string) =>
    [...competitionKeys.all, "event", eventId] as const,
  types: ["master", "competition-types"] as const,
  species: ["master", "species"] as const,
};

export function useEventCompetitions(eventId: string) {
  return useQuery({
    queryKey: competitionKeys.forEvent(eventId),
    queryFn: () => listEventCompetitions(eventId),
  });
}

/** Master data rarely changes: keep it for the whole session. */
export function useCompetitionTypes() {
  return useQuery({
    queryKey: competitionKeys.types,
    queryFn: listCompetitionTypes,
    staleTime: Infinity,
  });
}

export function useSpecies() {
  return useQuery({
    queryKey: competitionKeys.species,
    queryFn: listSpecies,
    staleTime: Infinity,
  });
}

export function useCreateCompetition(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: NewCompetition) => createCompetition(eventId, values),
    // Also on error: a partial create still added a competition.
    onSettled: () =>
      client.invalidateQueries({ queryKey: competitionKeys.forEvent(eventId) }),
  });
}
