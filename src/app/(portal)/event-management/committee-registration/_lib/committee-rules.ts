import type { PortalRecord } from "@/types/portal";

export const COMMITTEE_ROLES = ["Event PIC", "Race PIC", "Judge"] as const;

export function isDuplicateCommitteeAssignment(
  committee: PortalRecord[],
  draft: PortalRecord,
): boolean {
  return committee.some(
    (item) =>
      item.id !== draft.id &&
      item.eventId === draft.eventId &&
      item.userId === draft.userId &&
      item.role === draft.role &&
      (item.competitionId || "") === (draft.competitionId || ""),
  );
}
