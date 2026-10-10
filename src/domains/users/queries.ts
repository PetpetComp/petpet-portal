import { useQuery } from "@tanstack/react-query";
import { countUsers } from "./api";

export function useUsersCount(enabled: boolean) {
  return useQuery({
    queryKey: ["users", "count"],
    queryFn: countUsers,
    enabled,
  });
}
