/**
 * Pages rebuilt on TanStack Query fetch only what they show, so they skip the
 * legacy `PortalDataProvider`, which loads every collection (N+1 per event).
 * Add a route here when its page is migrated. When every route is listed,
 * delete the provider.
 */
const EVENT_LEGACY_PAGES =
  "event-registration|doorprize-drawing|event-participant";

const MIGRATED: RegExp[] = [
  /^\/home\/?$/, // Home
  /^\/event-management\/?$/, // Events list
  /^\/event-management\/create\/?$/, // New event wizard
  new RegExp(`^/event-management/(?!(?:${EVENT_LEGACY_PAGES})/?$)[^/]+/?$`), // Event overview
  /^\/event-management\/[^/]+\/competitions(\/create)?\/?$/, // Competitions tab, Add competition
  /^\/event-management\/[^/]+\/registrations\/?$/, // Registrations tab
  /^\/event-management\/[^/]+\/participants\/?$/, // Participants & check-in tab
  /^\/event-management\/[^/]+\/committee\/?$/, // Committee tab
  /^\/event-management\/[^/]+\/(sponsors|doorprize)\/?$/, // Tabs that are still "coming soon"
  /^\/event-management\/[^/]+\/edit\/?$/, // Edit event
  /^\/pet-management(\/[^/]+(\/edit)?)?\/?$/, // Pets: list, New pet, detail, Edit pet
  /^\/sponsorship-brand(\/[^/]+(\/edit)?)?\/?$/, // Brands: list, New brand, detail, Edit brand
  /^\/user-management(\/[^/]+(\/edit)?)?\/?$/, // Users: list, New user, detail, Edit user
  /^\/roles-access\/?$/, // Roles & access
  /^\/organization-management(\/[^/]+(\/(events|invitations|profile))?)?\/?$/, // Organizations: list, detail and its tabs
];

export function needsLegacyData(pathname: string): boolean {
  return !MIGRATED.some((route) => route.test(pathname));
}
