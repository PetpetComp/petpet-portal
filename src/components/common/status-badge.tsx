import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "danger" | "info";

const TONE_BY_STATUS: Record<string, StatusTone> = {
  Published: "success",
  Open: "success",
  Approved: "success",
  Paid: "success",
  Active: "success",
  Draft: "warning",
  Pending: "warning",
  pending: "warning",
  Rejected: "danger",
  rejected: "danger",
  approved: "success",
};

export function toneForStatus(status: string): StatusTone {
  return TONE_BY_STATUS[status] ?? "info";
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: ReactNode;
}) {
  return (
    <span className={`status-badge status-badge-${toneForStatus(status)}`}>
      {label ?? status}
    </span>
  );
}
