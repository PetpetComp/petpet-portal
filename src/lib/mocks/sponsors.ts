import type { SponsorBrand } from "@/types/sponsor";

const audit = {
  createdDate: "2026-02-03T09:15:00Z",
  createdBy: "partnership.team",
  updatedDate: "2026-09-01T13:30:00Z",
  updatedBy: "admin.petpet",
};

export const mockSponsors: SponsorBrand[] = [
  {
    id: "BRD-2026-0001",
    name: "PawFuel",
    logo: "",
    phone: "081270000001",
    campaign: "Power Every Paw",
    instagramId: "@pawfuel",
    tiktokId: "@pawfuel",
    facebookId: "PawFuel",
    youtubeId: "@pawfuel",
    threadsId: "@pawfuel",
    xId: "@pawfuel",
    picUserIds: ["USR-2026-0001"],
    assignments: [
      { id: "ASN-0001-01", eventId: "EVT-2026-0001", category: "Platinum" },
    ],
    ...audit,
  },
  {
    id: "BRD-2026-0002",
    name: "Happy Tail Nutrition",
    logo: "",
    phone: "081270000002",
    campaign: "Healthy Pets Happy Families",
    instagramId: "@happytail",
    tiktokId: "@happytail",
    facebookId: "Happy Tail Nutrition",
    youtubeId: "@happytail",
    threadsId: "@happytail",
    xId: "@happytail",
    picUserIds: ["USR-2026-0002"],
    assignments: [
      { id: "ASN-0002-01", eventId: "EVT-2026-0002", category: "Gold" },
    ],
    ...audit,
  },
];
