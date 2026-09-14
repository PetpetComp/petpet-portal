import type { PortalRecord } from "@/types/portal";

export const PAYMENT_STATUSES = ["Pending", "Paid", "Verified"] as const;

const CHANNELS = [
  { key: "earlyBird", category: "Early Bird" },
  { key: "online", category: "Online" },
  { key: "ots", category: "OTS" },
] as const;

export function resolvePriceCategory(
  competition: PortalRecord,
  when: Date = new Date(),
): { category: string; fee: number } {
  const timestamp = when.toISOString();
  for (const channel of CHANNELS) {
    const open = competition[channel.key + "Open"];
    const close = competition[channel.key + "Close"];
    if (open && close && timestamp >= open && timestamp <= close) {
      return { category: channel.category, fee: Number(competition[channel.key + "Price"] || 0) };
    }
  }
  const fallback = CHANNELS[CHANNELS.length - 1];
  return { category: fallback.category, fee: Number(competition[fallback.key + "Price"] || 0) };
}

export function isDuplicateRegistration(
  registrations: PortalRecord[],
  draft: PortalRecord,
): boolean {
  return registrations.some(
    (item) =>
      item.id !== draft.id &&
      item.petId === draft.petId &&
      item.competitionId === draft.competitionId,
  );
}

export function isAnimalMismatch(pet: PortalRecord, competition: PortalRecord): boolean {
  return pet.animal !== competition.animal;
}
