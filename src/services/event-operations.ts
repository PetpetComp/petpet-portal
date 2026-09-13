import {
  mockCommitteeRegistrations,
  mockDoorprizes,
  mockEventRegistrations,
  mockPartnerRegistrations,
} from "@/lib/mocks/event-operations";
import { delay, paginate } from "@/services/common";

function listForEvent<T extends { eventId: string }>(
  records: T[],
  eventId: string,
) {
  return delay(
    paginate(
      structuredClone(records.filter((record) => record.eventId === eventId)),
    ),
  );
}

export const eventOperationsService = {
  registrations: (eventId: string) =>
    listForEvent(mockEventRegistrations, eventId),
  committee: (eventId: string) =>
    listForEvent(mockCommitteeRegistrations, eventId),
  partners: (eventId: string) =>
    listForEvent(mockPartnerRegistrations, eventId),
  doorprizes: (eventId: string) => listForEvent(mockDoorprizes, eventId),
};
