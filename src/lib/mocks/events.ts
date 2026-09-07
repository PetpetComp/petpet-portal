import type { EventItem } from "@/types/event";

const audit = {
  createdDate: "2026-07-15T09:30:00Z",
  createdBy: "Admin Petpet",
  updatedDate: "2026-08-30T14:20:00Z",
  updatedBy: "Lifta Annisa",
};

export const mockEvents: EventItem[] = [
  {
    id: "EVT-2026-0001",
    name: "Jakarta Pet Festival 2026",
    photo: "",
    startDate: "2026-09-05T08:00:00+07:00",
    endDate: "2026-09-06T18:00:00+07:00",
    address: "JIExpo Kemayoran, Jl. Benyamin Suaeb",
    location: "Jakarta",
    organizer: "Petpet Competition Club",
    organizerLogo: "PPC",
    status: "Pending",
    ...audit,
  },
  {
    id: "EVT-2026-0002",
    name: "Surabaya Paw Race 2026",
    photo: "",
    startDate: "2026-09-04T10:00:00+07:00",
    endDate: "2026-09-04T20:00:00+07:00",
    address: "Grand City Convex, Jl. Walikota Mustajab",
    location: "Surabaya",
    organizer: "East Java Pet Sport",
    organizerLogo: "EJP",
    status: "Open",
    ...audit,
  },
  {
    id: "EVT-2026-0003",
    name: "Bandung Happy Paws Championship",
    photo: "",
    startDate: "2026-08-20T08:00:00+07:00",
    endDate: "2026-08-21T17:00:00+07:00",
    address: "Bandung Convention Centre",
    location: "Bandung",
    organizer: "Happy Paws Indonesia",
    organizerLogo: "HPI",
    status: "Closed",
    ...audit,
  },
];
