import type { PortalRecord } from "@/types/portal";
import { initials } from "@/lib/identity";

export { ANIMAL_OPTIONS } from "@/lib/constants/animals";

export function isDuplicatePet(pets: PortalRecord[], draft: PortalRecord): boolean {
  return pets.some(
    (pet) =>
      pet.id !== draft.id &&
      pet.name.trim().toLowerCase() === draft.name.trim().toLowerCase() &&
      pet.ownerUserId === draft.ownerUserId,
  );
}

export function hasActiveRegistration(
  registrations: PortalRecord[],
  petId: string,
): boolean {
  return registrations.some((registration) => registration.petId === petId);
}

export function petInitials(name: string): string {
  return initials(name, "P");
}
