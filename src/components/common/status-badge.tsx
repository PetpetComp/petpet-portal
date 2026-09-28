import type { ReactNode } from "react";

const SUCCESS = ["Open", "Verified", "Paid", "Saved", "Completed", "Published", "Approved", "approved", "Active"];
const WARNING = ["Running", "Pending", "Countdown", "Draft", "pending"];
const DANGER = ["Closed", "Stopped", "DSQ", "Rejected", "rejected"];

function toneFor(status: string): "success" | "warning" | "danger" | "neutral" {
  if (SUCCESS.includes(status)) return "success";
  if (WARNING.includes(status)) return "warning";
  if (DANGER.includes(status)) return "danger";
  return "neutral";
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: ReactNode;
}) {
  return (
    <span className={"status-badge status-" + toneFor(status)}>
      <span className="status-dot" />
      {label ?? status}
    </span>
  );
}
