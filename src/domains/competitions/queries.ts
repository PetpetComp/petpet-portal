import { useQuery } from "@tanstack/react-query";
import { listEventCompetitions } from "./api";

export const competitionKeys = {
  all: ["competitions"] as const,
  forEvent: (eventId: string) =>
    [...competitionKeys.all, "event", eventId] as const,
};

export function useEventCompetitions(eventId: string) {
  return useQuery({
    queryKey: competitionKeys.forEvent(eventId),
    queryFn: () => listEventCompetitions(eventId),
  });
}
