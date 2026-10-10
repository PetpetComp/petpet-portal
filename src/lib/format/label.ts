/** "NOT_CHECKED_IN" -> "Not checked in", for showing backend enum values. */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase().trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

/** 65000 -> "Rp 65.000" */
export const rupiah = (amount: number) =>
  "Rp " + amount.toLocaleString("id-ID");
