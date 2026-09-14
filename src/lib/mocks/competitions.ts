import type { Competition } from "@/types/competition";

const audit = {
  createdDate: "2026-06-10T09:15:00Z",
  createdBy: "Nadia Putri",
  updatedDate: "2026-08-15T13:20:00Z",
  updatedBy: "Nadia Putri",
};

export const mockCompetitions: Competition[] = [
  {
    id: "CMP-2026-0001",
    eventId: "EVT-2026-0001",
    name: "Small Dog Sprint",
    type: "Race",
    animal: "Dog",
    earlyBirdPrice: 75000,
    onlinePrice: 90000,
    otsPrice: 105000,
    earlyBirdOpen: "2026-07-01T08:00:00+07:00",
    earlyBirdClose: "2026-07-15T23:59:00+07:00",
    onlineOpen: "2026-07-16T00:00:00+07:00",
    onlineClose: "2026-08-31T23:59:00+07:00",
    otsOpen: "2026-09-05T06:00:00+07:00",
    otsClose: "2026-09-05T08:00:00+07:00",
    lanes: 4,
    registrationStatus: "Open",
    ...audit,
  },
  {
    id: "CMP-2026-0002",
    eventId: "EVT-2026-0001",
    name: "Best Costume Contest",
    type: "Contest",
    animal: "Dog",
    earlyBirdPrice: 50000,
    onlinePrice: 65000,
    otsPrice: 80000,
    earlyBirdOpen: "2026-07-01T08:00:00+07:00",
    earlyBirdClose: "2026-07-20T23:59:00+07:00",
    onlineOpen: "2026-07-21T00:00:00+07:00",
    onlineClose: "2026-09-01T20:00:00+07:00",
    otsOpen: "2026-09-05T07:00:00+07:00",
    otsClose: "2026-09-05T10:00:00+07:00",
    registrationStatus: "Open",
    contestCriteria: JSON.stringify([
      { name: "Appearance", maxPoints: 100 },
      { name: "Creativity", maxPoints: 100 },
      { name: "Performance", maxPoints: 100 },
    ]),
    ...audit,
  },
];
