import { useHomeEvents } from "@/domains/events/queries";
import { eventsByDay, relevantEvents } from "@/domains/events/schedule";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";

/** Berapa event "Coming up" yang ditampilkan di kartu samping. */
export const UPCOMING_SHOWN = 3;

/**
 * Jadwal untuk Home organizer: event hari ini dan event berikutnya milik akun ini.
 * Dipanggil dari `organizer-home.tsx`. Super admin melihat semua event; selain itu hanya event
 * organisasi akun dan event tempat akun ditugaskan (`relevantEvents`). Disaring di browser
 * karena API belum punya filter tanggal (docs 09 bagian F).
 * Output: `today`, `upcoming` (maksimal `UPCOMING_SHOWN`), `upcomingTotal`, dan status query.
 */
export function useHomeSchedule(now: Date = new Date()) {
  const { can, assignments, memberships } = useAuth();
  const isAdmin = can(PERMISSION.ORGANIZATION_VERIFY);
  const events = useHomeEvents(true);

  const mine = relevantEvents(events.data?.items ?? [], {
    isAdmin,
    organizationIds: memberships.map((m) => m.organizationId),
    assignedEventIds: assignments.map((a) => a.eventId),
  });
  // Batas besar dulu supaya jumlah total "Coming up" bisa dipakai kartu statistik.
  const split = eventsByDay(mine, now, mine.length || 1);
  // Hari ini hanya event terbit; event batal tidak ikut daftar sama sekali.
  const today = split.today.filter((e) => e.status === "PUBLISHED");
  const upcoming = split.upcoming.filter((e) => e.status !== "CANCELLED");

  return {
    isAdmin,
    isPending: events.isPending,
    isError: events.isError,
    error: events.error,
    refetch: events.refetch,
    eventsTotal: events.data?.total,
    today,
    upcoming: upcoming.slice(0, UPCOMING_SHOWN),
    upcomingTotal: upcoming.length,
  };
}
