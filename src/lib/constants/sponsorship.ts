import type { PortalRecord } from "@/types/portal";
import type { SponsorCategory } from "@/types/sponsor";

export const SPONSOR_CATEGORIES: SponsorCategory[] = [
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
  "Media Partner",
];

export function categoryClass(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

export function canModifyAssignment(eventStatus: string | undefined): boolean {
  return eventStatus === "Pending";
}

export function isDuplicateAssignment(
  assignments: PortalRecord[],
  brandId: string,
  eventId: string,
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.sponsorId === brandId && assignment.eventId === eventId,
  );
}
