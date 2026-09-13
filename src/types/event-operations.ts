import type { PaymentStatus } from "@/types/competition";

export interface EventRegistration {
  id: string;
  eventId: string;
  competitionId: string;
  userId: string;
  petId: string;
  paymentStatus: PaymentStatus;
}

export interface CommitteeRegistration {
  id: string;
  eventId: string;
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
