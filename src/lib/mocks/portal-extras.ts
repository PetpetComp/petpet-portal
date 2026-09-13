import { mockPets } from "./pets";
import { mockCompetitions } from "./competitions";
import type { Pet } from "@/types/pet";
import type { Competition } from "@/types/competition";
import type { EventRegistration } from "@/types/event-operations";

export const additionalPets: Pet[] = [
  {
    ...mockPets[0],
    id: "PET-00401",
    name: "Luna",
    variant: "Shih Tzu",
    gender: "Female",
    ownerUserId: "USR-2026-0003",
    ownerName: "Bima Setiawan",
  },
  {
    ...mockPets[1],
    id: "PET-00402",
    name: "Coco",
    variant: "Beagle",
    ownerUserId: "USR-2026-0001",
    ownerName: "Andi Pratama",
  },
];
export const additionalCompetitions: Competition[] = [
  {
    ...mockCompetitions[0],
    id: "CMP-2026-0003",
    name: "Agility Time Trial",
    type: "Time Trial",
  },
  {
    ...mockCompetitions[0],
    id: "CMP-2026-0004",
    name: "Checkpoint Challenge",
    type: "Checkpoint Race",
  },
];
const petOwners = [
  ["PET-00127", "USR-2026-0001"],
  ["PET-00132", "USR-2026-0002"],
  ["PET-00401", "USR-2026-0003"],
  ["PET-00402", "USR-2026-0001"],
];
export const additionalRegistrations: EventRegistration[] = [
  ...mockCompetitions,
  ...additionalCompetitions,
].flatMap((competition) =>
  petOwners.flatMap(([petId, userId], index) =>
    competition.id === "CMP-2026-0001" && index === 0
      ? []
      : [
          {
            id: "REG-" + competition.id + "-" + petId,
            eventId: competition.eventId,
            competitionId: competition.id,
            petId,
            userId,
            paymentStatus: "Verified" as const,
          },
        ],
  ),
);
