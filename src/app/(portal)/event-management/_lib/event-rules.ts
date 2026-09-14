import type { PortalRecord } from "@/types/portal";
import { initials } from "@/lib/identity";

export function isDuplicateEventName(
  events: PortalRecord[],
  draft: PortalRecord,
): boolean {
  return events.some(
    (event) =>
      event.id !== draft.id &&
      event.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
  );
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  return !startDate || !endDate || endDate > startDate;
}

export function isEligibleEvent(event: PortalRecord): boolean {
  return event.status === "Open" || event.status === "Pending";
}

export function eventInitials(name: string): string {
  return initials(name, "EV");
}

export function hasLinkedRecords(
  data: {
    competitions: PortalRecord[];
    registrations: PortalRecord[];
    committee: PortalRecord[];
    partners: PortalRecord[];
    prizes: PortalRecord[];
  },
  eventId: string,
): boolean {
  return [
    ...data.competitions,
    ...data.registrations,
    ...data.committee,
    ...data.partners,
    ...data.prizes,
  ].some((item) => item.eventId === eventId);
}
