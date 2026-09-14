import type { PortalRecord } from "@/types/portal";
import { generateUniqueSlug, initials } from "@/lib/identity";

export { isValidPhone, isValidEmail } from "@/lib/validation";

export function isDuplicateContact(
  users: PortalRecord[],
  draft: PortalRecord,
): boolean {
  return users.some(
    (user) =>
      user.id !== draft.id &&
      ((!!draft.email && user.email.toLowerCase() === draft.email.toLowerCase()) ||
        user.phone === draft.phone),
  );
}

export function hasLinkedRecords(
  data: {
    pets: PortalRecord[];
    registrations: PortalRecord[];
    committee: PortalRecord[];
    brands: PortalRecord[];
    prizes: PortalRecord[];
  },
  userId: string,
): boolean {
  return (
    data.pets.some((pet) => pet.ownerUserId === userId) ||
    [...data.registrations, ...data.committee].some(
      (row) => row.userId === userId,
    ) ||
    data.brands.some((row) => row.picUserIds?.split(",").includes(userId)) ||
    data.prizes.some((row) => row.winnerUserIds?.split(",").includes(userId))
  );
}

export function generateUsername(
  firstName: string,
  lastName: string,
  existing: PortalRecord[],
): string {
  return generateUniqueSlug(
    firstName + (lastName ? "." + lastName : ""),
    existing.map((user) => user.username),
  );
}

export function userInitials(firstName: string, lastName: string): string {
  return initials(firstName + " " + lastName, "U");
}
