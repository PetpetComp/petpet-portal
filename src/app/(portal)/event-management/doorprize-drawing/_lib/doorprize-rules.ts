import type { PortalRecord } from "@/types/portal";

export function eligibleForDraw(registrations: PortalRecord[], eventId: string): PortalRecord[] {
  return registrations.filter(
    (row) => row.eventId === eventId && row.paymentStatus === "Paid" && !row.doorprizeStatus,
  );
}

export function hasPendingWinner(registrations: PortalRecord[], eventId: string): boolean {
  return registrations.some((row) => row.eventId === eventId && row.doorprizeStatus === "Waiting");
}

export function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return items[Math.floor(random * items.length)];
}
