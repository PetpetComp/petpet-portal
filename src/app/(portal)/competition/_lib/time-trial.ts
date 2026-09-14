export type AttemptStatus = "finish" | "dnf" | "dns" | "dsq";

export const ATTEMPT_STATUS_LABEL: Record<AttemptStatus, string> = {
  finish: "Finish",
  dnf: "Did Not Finish",
  dns: "Did Not Start",
  dsq: "Disqualified",
};

export const ATTEMPT_STATUS_TONE: Record<AttemptStatus, "success" | "warning" | "neutral" | "danger"> = {
  finish: "success",
  dnf: "warning",
  dns: "neutral",
  dsq: "danger",
};

export interface Attempt {
  status: AttemptStatus;
  time: number | null;
  distance?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export function parseAttempts(json: string | undefined): Record<string, Attempt> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function nextUnresolvedIndex(
  order: string[],
  attempts: Record<string, Attempt>,
  from: number,
): number {
  for (let offset = 0; offset < order.length; offset++) {
    const index = (from + offset) % order.length;
    if (!attempts[order[index]]) return index;
  }
  return -1;
}
