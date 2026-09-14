import type {
  CommitteeRegistration,
  Doorprize,
  EventRegistration,
  PartnerRegistration,
} from "@/types/event-operations";

export const mockEventRegistrations: EventRegistration[] = [
  {
    id: "REG-2026-0001",
    eventId: "EVT-2026-0001",
    competitionId: "CMP-2026-0001",
    userId: "USR-2026-0001",
    petId: "PET-00127",
    paymentStatus: "Verified",
    priceCategory: "Early Bird",
    registrationFee: 75000,
    registrationDate: "2026-07-05T09:00:00Z",
    paymentDate: "2026-07-05T09:10:00Z",
    paymentBy: "andi.pratama",
    paymentMethod: "Bank Transfer",
    paymentVerificationDate: "2026-07-05T14:00:00Z",
    paymentVerifiedBy: "admin.petpet",
    createdDate: "2026-07-05T09:00:00Z",
    createdBy: "andi.pratama",
    updatedDate: "2026-07-05T14:00:00Z",
    updatedBy: "admin.petpet",
  },
];

export const mockCommitteeRegistrations: CommitteeRegistration[] = [
  {
    id: "COM-2026-0001",
    eventId: "EVT-2026-0001",
    userId: "USR-2026-0002",
    role: "Race PIC",
  },
];

export const mockPartnerRegistrations: PartnerRegistration[] = [
  {
    id: "PAR-2026-0001",
    eventId: "EVT-2026-0001",
    sponsorId: "BRD-2026-0001",
    category: "Sponsor",
  },
];

export const mockDoorprizes: Doorprize[] = [
  {
    id: "PRIZE-2026-0001",
    eventId: "EVT-2026-0001",
    name: "Pet Care Gift Set",
    quantity: 2,
    winnerUserIds: [],
  },
];
