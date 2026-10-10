import type { PortalRecord } from "@/types/portal";

/**
 * Aturan lama yang masih dipakai halaman Find Event (Event Registration lama):
 * hanya event Open atau Pending yang boleh dipilih. Akan hilang bersama halaman itu.
 */
export function isEligibleEvent(event: PortalRecord): boolean {
  return event.status === "Open" || event.status === "Pending";
}
