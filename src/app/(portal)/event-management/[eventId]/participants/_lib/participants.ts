import type { Competition } from "@/domains/competitions/types";
import type { Entry, EntrySummary } from "@/domains/entries/types";

/**
 * Screen helpers for the check-in desk. They only choose what to show or
 * which row a scan points at; whether a check-in is allowed comes from
 * `entry.actions` (the backend decides).
 */

/** The competition the desk most likely works on: running now, else the next one, else the first. */
export function defaultCompetitionId(competitions: Competition[]): string {
  return (
    (
      competitions.find((c) => c.status === "ONGOING") ??
      competitions.find((c) => c.status === "SCHEDULED") ??
      competitions[0]
    )?.id ?? ""
  );
}

/**
 * A scanned QR holds the participant code. Check in straight away only when
 * exactly one row carries that code and the API allows checking it in.
 */
export function scanTarget(items: Entry[], code: string): Entry | null {
  const matches = items.filter((e) => e.participantCode === code);
  return matches.length === 1 && matches[0].actions.checkIn ? matches[0] : null;
}

/** "12 of 31 checked in" (approved, non-withdrawn entries; from `summary`). */
export const checkedInText = (summary: EntrySummary) =>
  `${summary.checkedIn} of ${summary.approved} checked in`;
