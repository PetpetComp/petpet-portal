export function StatusBadge({ status }: { status: string }) {
  const tone = ["Open", "Verified", "Paid", "Saved", "Completed"].includes(
    status,
  )
    ? "success"
    : ["Running", "Pending", "Countdown"].includes(status)
      ? "warning"
      : ["Closed", "Stopped", "DSQ"].includes(status)
        ? "danger"
        : "neutral";
  return (
    <span className={"status-badge status-" + tone}>
      <span className="status-dot" />
      {status}
    </span>
  );
}
