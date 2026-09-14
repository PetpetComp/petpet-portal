import type { ContestCriterion } from "@/app/(portal)/event-management/[eventId]/competitions/_lib/competition-rules";

export type ParticipantStatus = "waiting" | "judging" | "completed" | "dns" | "dq";

export const STATUS_LABEL: Record<ParticipantStatus, string> = {
  waiting: "Waiting",
  judging: "In Judging",
  completed: "Completed",
  dns: "DNS",
  dq: "DQ",
};

export const STATUS_TONE: Record<ParticipantStatus, "neutral" | "warning" | "success" | "danger"> = {
  waiting: "neutral",
  judging: "warning",
  completed: "success",
  dns: "neutral",
  dq: "danger",
};

export interface Assessment {
  status: ParticipantStatus;
  scores: Record<string, number>;
  updatedAt?: string;
}

export function parseAssessments(json: string | undefined): Record<string, Assessment> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function assessmentFor(
  assessments: Record<string, Assessment>,
  petId: string,
): Assessment {
  return assessments[petId] ?? { status: "waiting", scores: {} };
}

export function totalScore(assessment: Assessment, criteria: ContestCriterion[]): number {
  return criteria.reduce((sum, criterion) => sum + (assessment.scores[criterion.name] || 0), 0);
}

export function isReadyToComplete(assessment: Assessment, criteria: ContestCriterion[]): boolean {
  return criteria.every((criterion) => {
    const score = assessment.scores[criterion.name];
    return score !== undefined && score >= 0 && score <= criterion.maxPoints;
  });
}
