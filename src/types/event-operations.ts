import type { AuditFields } from "@/types/common";
import type { PaymentStatus } from "@/types/competition";

export type PriceCategory = "Early Bird" | "Online" | "OTS";

export interface EventRegistration extends AuditFields {
  id: string;
  eventId: string;
  competitionId: string;
  userId: string;
  petId: string;
  paymentStatus: PaymentStatus;
  priceCategory?: PriceCategory;
  registrationFee?: number;
  registrationDate?: string;
  paymentDate?: string;
  paymentBy?: string;
  paymentMethod?: string;
  paymentVerificationDate?: string;
  paymentVerifiedBy?: string;
  doorprizeStatus?: "Waiting" | "Claimed" | "Void";
  doorprizeDrawnAt?: string;
  doorprizeStatusDate?: string;
}

export interface CommitteeRegistration {
  id: string;
  eventId: string;
  competitionId?: string;
  userId: string;
  role: "Event PIC" | "Race PIC" | "Judge";
}

export interface PartnerRegistration {
  id: string;
  eventId: string;
  sponsorId: string;
  category: "Sponsor" | "Media Partner";
}

export interface Doorprize {
  id: string;
  eventId: string;
  name: string;
  quantity: number;
  winnerUserIds: string[];
}
