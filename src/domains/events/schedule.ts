import type { Event } from "./types";

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Splits events into those running today (any overlap with today, in the
 * viewer's time zone) and the next ones, soonest first. Past events are dropped.
 */
export function eventsByDay(
  events: Event[],
  now: Date,
  upcomingLimit = 3,
): { today: Event[]; upcoming: Event[] } {
  const dayStart = startOfDay(now).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const time = (iso: string) => new Date(iso).getTime();
  const valid = events.filter((e) => !Number.isNaN(time(e.startAt)));
  const today = valid.filter(
    (e) => time(e.startAt) < dayEnd && time(e.endAt || e.startAt) >= dayStart,
  );
  const upcoming = valid
    .filter((e) => time(e.startAt) >= dayEnd)
    .sort((a, b) => time(a.startAt) - time(b.startAt))
    .slice(0, upcomingLimit);
  return { today, upcoming };
}

/**
 * Events this person works on: their organizations' events plus events they
 * are assigned to. Platform admins see everything.
 */
export function relevantEvents(
  events: Event[],
  access: {
    isAdmin: boolean;
    organizationIds: string[];
    assignedEventIds: string[];
  },
): Event[] {
  if (access.isAdmin) return events;
  return events.filter(
    (e) =>
      access.organizationIds.includes(e.organizationId) ||
      access.assignedEventIds.includes(e.id),
  );
}
