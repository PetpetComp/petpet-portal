import type { PortalRecord } from "@/types/portal";

export const COMPETITION_TYPES = [
  "Race",
  "Checkpoint Race",
  "Contest",
  "Time Trial",
  "Checkpoint Time Trial",
] as const;

export const REGISTRATION_CHANNELS = [
  { key: "earlyBird", label: "Early Bird", description: "Early registration period" },
  { key: "online", label: "Online", description: "Standard online registration" },
  { key: "ots", label: "OTS", description: "On-the-spot registration" },
] as const;

export function typeConfigFields(type: string): {
  lanes: boolean;
  checkpoints: boolean;
  cutoff: boolean;
} {
  return {
    lanes: type === "Race" || type === "Checkpoint Race",
    checkpoints: type === "Checkpoint Race" || type === "Checkpoint Time Trial",
    cutoff: type === "Time Trial" || type === "Checkpoint Time Trial",
  };
}

export function runPathFor(type: string): "contest" | "time-trial" | "run-match" {
  if (type === "Contest") return "contest";
  if (type === "Time Trial" || type === "Checkpoint Time Trial") return "time-trial";
  return "run-match";
}

export function isDuplicateCompetitionName(
  competitions: PortalRecord[],
  draft: PortalRecord,
): boolean {
  return competitions.some(
    (item) =>
      item.id !== draft.id &&
      item.eventId === draft.eventId &&
      item.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
  );
}

export function isValidChannelWindow(open: string, close: string): boolean {
  return !open || !close || close > open;
}

export function canCloseRegistration(status: string | undefined): boolean {
  return status !== "Closed";
}

export interface ContestCriterion {
  name: string;
  maxPoints: number;
}

export const DEFAULT_CONTEST_CRITERIA: ContestCriterion[] = [
  { name: "Appearance", maxPoints: 100 },
  { name: "Creativity", maxPoints: 100 },
  { name: "Performance", maxPoints: 100 },
];

export function parseContestCriteria(json: string | undefined): ContestCriterion[] {
  if (!json) return DEFAULT_CONTEST_CRITERIA;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CONTEST_CRITERIA;
  } catch {
    return DEFAULT_CONTEST_CRITERIA;
  }
}
