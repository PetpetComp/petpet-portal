import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { competitionKeys } from "@/domains/competitions/queries";
import { listEventCompetitions } from "@/domains/competitions/api";
import { getEvent } from "@/domains/events/api";
import { eventKeys } from "@/domains/events/queries";
import { eventsByDay } from "@/domains/events/schedule";
import type { Event } from "@/domains/events/types";
import {
  buildAssignmentGroups,
  type AssignmentGroup,
} from "@/domains/staff/my-assignments";
import { useAuth } from "@/hooks/use-auth";

/**
 * Data layar My assignments: kompetisi HARI INI milik akun yang login.
 * Dipanggil dari `assignments-page.tsx`. Alurnya:
 *   1. penugasan akun dari `useAuth().assignments` (asal: `staff_assignments` di GET /auth/me);
 *   2. event dari penugasan itu dimuat, lalu disaring yang berlangsung hari ini;
 *   3. kompetisi event hari ini dimuat dan dipasangkan ke penugasan (`buildAssignmentGroups`).
 * Output: grup per event, status memuat, dan error + `refetch` untuk tombol Try again.
 */
export function useMyAssignments(now: Date = new Date()) {
  const { assignments, loading: authLoading } = useAuth();

  const eventIds = useMemo(
    () => [...new Set(assignments.map((a) => a.eventId))],
    [assignments],
  );

  const eventQueries = useQueries({
    queries: eventIds.map((id) => ({
      queryKey: eventKeys.detail(id),
      queryFn: () => getEvent(id),
    })),
  });
  const events: Event[] = eventQueries.flatMap((q) =>
    q.data && q.data.status === "PUBLISHED" ? [q.data] : [],
  );
  const todayEvents = eventsByDay(events, now).today;

  const competitionQueries = useQueries({
    queries: todayEvents.map((event) => ({
      queryKey: competitionKeys.forEvent(event.id),
      queryFn: () => listEventCompetitions(event.id),
    })),
  });

  const all = [...eventQueries, ...competitionQueries];
  const failed = all.find((q) => q.isError);
  const competitionsByEvent = Object.fromEntries(
    todayEvents.map((event, i) => [event.id, competitionQueries[i].data ?? []]),
  );
  const groups: AssignmentGroup[] = buildAssignmentGroups(
    assignments,
    todayEvents,
    competitionsByEvent,
  );

  return {
    groups,
    isLoading: authLoading || all.some((q) => q.isPending),
    isError: failed !== undefined,
    error: failed?.error ?? null,
    refetch: () => Promise.all(all.map((q) => q.refetch())),
  };
}
