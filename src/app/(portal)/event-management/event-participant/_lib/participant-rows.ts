import type { PortalRecord } from "@/types/portal";

export interface ParticipantRow {
  id: string;
  eventName: string;
  competitionName: string;
  competitionType: string;
  participantId: string;
  ownerName: string;
  petName: string;
  animal: string;
  variant: string;
  paymentStatus: string;
  registeredDate: string;
  registeredBy: string;
  paymentDate: string;
  paymentBy: string;
  paymentMethod: string;
  paymentAmount: number;
  paymentPeriod: string;
  verifiedDate: string;
  verifiedBy: string;
  createdDate: string;
  createdBy: string;
  updatedDate: string;
  updatedBy: string;
}

export function buildParticipantRows(data: {
  registrations: PortalRecord[];
  events: PortalRecord[];
  competitions: PortalRecord[];
  pets: PortalRecord[];
  users: PortalRecord[];
}): ParticipantRow[] {
  return data.registrations.map((registration) => {
    const competition = data.competitions.find(
      (item) => item.id === registration.competitionId,
    );
    const event = data.events.find((item) => item.id === registration.eventId);
    const pet = data.pets.find((item) => item.id === registration.petId);
    const owner = data.users.find((item) => item.id === registration.userId);
    return {
      id: registration.id,
      eventName: event?.name ?? "-",
      competitionName: competition?.name ?? "-",
      competitionType:
        competition?.type ?? competition?.competitionTypeId ?? "-",
      participantId:
        pet?.id ?? registration.petId ?? registration.teamId ?? "-",
      ownerName: owner?.name ?? "-",
      petName: pet?.name ?? "-",
      animal: pet?.animal ?? pet?.speciesId ?? "-",
      variant: pet?.variant ?? pet?.morphId ?? "-",
      paymentStatus: registration.paymentStatus,
      registeredDate: registration.registrationDate ?? "",
      registeredBy: registration.createdBy ?? "",
      paymentDate: registration.paymentDate ?? "",
      paymentBy: registration.paymentBy ?? "",
      paymentMethod: registration.paymentMethod ?? "",
      paymentAmount: Number(registration.registrationFee || 0),
      paymentPeriod: registration.priceCategory ?? "",
      verifiedDate: registration.paymentVerificationDate ?? "",
      verifiedBy: registration.paymentVerifiedBy ?? "",
      createdDate: registration.createdDate ?? "",
      createdBy: registration.createdBy ?? "",
      updatedDate: registration.updatedDate ?? "",
      updatedBy: registration.updatedBy ?? "",
    };
  });
}
