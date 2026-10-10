import { useQuery } from "@tanstack/react-query";
import { countUsers, searchUsers } from "./api";
import { USER_SEARCH_MIN_LENGTH } from "./types";

export function useUsersCount(enabled: boolean) {
  return useQuery({
    queryKey: ["users", "count"],
    queryFn: countUsers,
    enabled,
  });
}

/**
 * Pencarian user untuk dipilih. Baru jalan dari 2 huruf; `q` sebaiknya sudah di-debounce
 * oleh pemanggil supaya tidak menembak server di tiap ketikan.
 */
export function useUserSearch(q: string, organizationId?: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ["users", "search", term, organizationId ?? null],
    queryFn: () => searchUsers(term, organizationId),
    enabled: term.length >= USER_SEARCH_MIN_LENGTH,
    staleTime: 60_000,
  });
}
