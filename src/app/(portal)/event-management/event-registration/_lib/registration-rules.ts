import type { Row } from "@/services/backend-records";
import type { PortalRecord } from "@/types/portal";

export function isDuplicateRegistration(
  registrations: PortalRecord[],
  draft: { id: string; petId: string; competitionId: string },
): boolean {
  return registrations.some(
    (item) =>
      item.id !== draft.id &&
      item.petId === draft.petId &&
      item.competitionId === draft.competitionId,
  );
}

export function currentPeriod(
  periods: Row[],
  when: Date = new Date(),
): Row | undefined {
  const timestamp = when.toISOString();
  return periods.find((period) => {
    const start = period.registration_start_at;
    const end = period.registration_end_at;
    return (
      typeof start === "string" &&
      typeof end === "string" &&
      timestamp >= start &&
      timestamp <= end
    );
  });
}

export function periodLabel(period: Row): string {
  const type = String(period.period_type ?? "").replaceAll("_", " ");
  return type + " · Rp " + String(period.price ?? "-");
}
