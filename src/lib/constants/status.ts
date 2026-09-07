export type BadgeVariant =
  "neutral" | "success" | "warning" | "danger" | "info";

export const STATUS_BADGE_MAP: Record<string, BadgeVariant> = {
  Pending: "warning",
  Open: "success",
  Closed: "danger",
  Paid: "info",
  Verified: "success",
  Active: "success",
  Inactive: "danger",
};

export function statusToBadgeVariant(status: string): BadgeVariant {
  return STATUS_BADGE_MAP[status] ?? "neutral";
}
