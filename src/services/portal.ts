import { mockEvents } from "@/lib/mocks/events";
import { mockUsers } from "@/lib/mocks/users";
import { mockPets } from "@/lib/mocks/pets";
import { mockSponsors } from "@/lib/mocks/sponsors";
import { mockCompetitions } from "@/lib/mocks/competitions";
import {
  mockEventRegistrations,
  mockCommitteeRegistrations,
  mockPartnerRegistrations,
  mockDoorprizes,
} from "@/lib/mocks/event-operations";
import type { PortalData, PortalRecord } from "@/types/portal";
import {
  additionalPets,
  additionalCompetitions,
  additionalRegistrations,
} from "@/lib/mocks/portal-extras";

function flatten(record: object, name: string): PortalRecord {
  const fields = Object.fromEntries(
    Object.entries(record)
      .filter(
        ([, value]) => typeof value === "string" || typeof value === "number",
      )
      .map(([key, value]) => [key, String(value)]),
  );
  return { ...fields, id: String(fields.id), name };
}

export function getPortalData(): PortalData {
  return {
    events: mockEvents.map((item) => flatten(item, item.name)),
    users: mockUsers.map((item) =>
      flatten(item, item.firstName + " " + item.lastName),
    ),
    pets: [...mockPets, ...additionalPets].map((item) =>
      flatten(item, item.name),
    ),
    brands: mockSponsors.map((item) => ({
      ...flatten(item, item.name),
      picUserId: item.picUserIds[0] ?? "",
    })),
    competitions: [...mockCompetitions, ...additionalCompetitions].map(
      (item) => ({
        ...flatten(item, item.name),
        lanes: "4",
        cutoff: "60",
        checkpoints: "3",
      }),
    ),
    registrations: [...mockEventRegistrations, ...additionalRegistrations].map(
      (item) => flatten(item, "Registration " + item.id),
    ),
    committee: mockCommitteeRegistrations.map((item) =>
      flatten(item, "Committee " + item.id),
    ),
    partners: mockPartnerRegistrations.map((item) =>
      flatten(item, "Partner " + item.id),
    ),
    prizes: mockDoorprizes.map((item) => ({
      ...flatten(item, item.name),
      winnerUserIds: item.winnerUserIds.join(","),
    })),
  };
}
