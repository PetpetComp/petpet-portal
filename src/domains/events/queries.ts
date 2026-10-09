import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { deleteEvent, listEvents, organizationNames } from "./api";

export const eventKeys = {
  all: ["events"] as const,
  list: (page: number, perPage: number) =>
    [...eventKeys.all, "list", { page, perPage }] as const,
  organizerNames: ["organizations", "names"] as const,
};

/** `page` is 1-based, like the API. */
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
