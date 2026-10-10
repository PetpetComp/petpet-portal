import { useQuery } from "@tanstack/react-query";
import {
  countOrganizations,
  countPendingApplications,
  listOrganizations,
} from "./api";

export const organizationKeys = {
  all: ["organizations"] as const,
  list: ["organizations", "list"] as const,
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

/** Daftar organisasi aktif, di-cache 5 menit karena jarang berubah. */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list,
    queryFn: listOrganizations,
    staleTime: 5 * 60_000,
  });
}
