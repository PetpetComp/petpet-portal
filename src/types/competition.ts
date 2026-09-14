import type { AuditFields } from "@/types/common";

export type CompetitionType =
  "Race" | "Checkpoint Race" | "Contest" | "Time Trial" | "Checkpoint Time Trial";

export type PaymentStatus = "Pending" | "Paid" | "Verified";

export interface Competition extends AuditFields {
  id: string;
  eventId: string;
  name: string;
  type: CompetitionType;
  animal: string;
  earlyBirdPrice: number;
  onlinePrice: number;
  otsPrice: number;
  earlyBirdOpen: string;
  earlyBirdClose: string;
  onlineOpen: string;
  onlineClose: string;
  otsOpen: string;
  otsClose: string;
  lanes?: number;
  checkpoints?: number;
  cutoff?: number;
  registrationStatus?: "Open" | "Closed";
  registrationClosedDate?: string;
  registrationClosedBy?: string;
  contestCriteria?: string;
  contestAssessments?: string;
  raceBracket?: string;
  raceStatus?: "Open" | "Closed";
  timeTrialAttempts?: string;
}
