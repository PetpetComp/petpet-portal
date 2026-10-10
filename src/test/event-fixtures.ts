import type { Event, EventPage, EventSummary } from "@/domains/events/types";

/** Bentuk layar sebuah event untuk tes komponen. Timpa field yang dibutuhkan lewat `over`. */
export function eventFixture(over: Partial<Event> = {}): Event {
  return {
    id: "e1",
    code: "EVT-2026-0002",
    organizationId: "o1",
    organizationName: "East Java Pet Sport",
    name: "Surabaya Paw Race 2026",
    tagline: "",
    description: "",
    venueName: "Grand City Convex, Surabaya",
    venueAddress: "",
    mapLocation: "",
    timezone: "Asia/Jakarta",
    startAt: new Date(2026, 8, 4, 10, 0).toISOString(),
    endAt: new Date(2026, 8, 4, 20, 0).toISOString(),
    status: "PUBLISHED",
    phase: "EVENT_DAY",
    ...over,
  };
}

/** Satu halaman list event untuk tes. `summary` null meniru backend asli. */
export function eventPageFixture(
  items: Event[],
  summary: EventSummary | null = null,
  total = items.length,
): EventPage {
  return {
    items,
    meta: { currentPage: 1, perPage: 8, total, lastPage: 1 },
    summary,
  };
}
