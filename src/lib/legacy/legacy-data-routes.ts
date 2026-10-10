/**
 * Pages rebuilt on TanStack Query fetch only what they show, so they skip the
 * legacy `PortalDataProvider`, which loads every collection (N+1 per event).
 * Add a route here when its page is migrated. When every route is listed,
 * delete the provider.
 */
const EVENT_LEGACY_PAGES =
  "create|event-registration|committee-registration|partner-registration|doorprize-drawing|event-participant";

const MIGRATED: RegExp[] = [
  /^\/home\/?$/, // Home
  /^\/event-management\/?$/, // Events list
  new RegExp(`^/event-management/(?!(?:${EVENT_LEGACY_PAGES})/?$)[^/]+/?$`), // Event overview
  /^\/event-management\/[^/]+\/competitions(\/create)?\/?$/, // Competitions tab, Add competition
  /^\/event-management\/[^/]+\/registrations\/?$/, // Registrations tab
  /^\/event-management\/[^/]+\/participants\/?$/, // Participants & check-in tab
];

export function needsLegacyData(pathname: string): boolean {
  return !MIGRATED.some((route) => route.test(pathname));
}
