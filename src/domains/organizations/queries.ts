import { useQuery } from "@tanstack/react-query";
import { countOrganizations, countPendingApplications } from "./api";

export const organizationKeys = {
  all: ["organizations"] as const,
  pendingApplications: ["organizer-applications", "pending-count"] as const,
  count: ["organizations", "count"] as const,
};

export function usePendingApplicationsCount(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.pendingApplications,
    queryFn: countPendingApplications,
    enabled,
  });
}

export function useOrganizationsCount(enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.count,
    queryFn: countOrganizations,
    enabled,
  });
}
