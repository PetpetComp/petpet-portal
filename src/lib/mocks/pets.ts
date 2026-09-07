import type { Pet } from "@/types/pet";

const audit = {
  createdDate: "2026-03-14T10:15:00Z",
  createdBy: "andi.pratama",
  updatedDate: "2026-09-01T11:30:00Z",
  updatedBy: "admin.petpet",
};

export const mockPets: Pet[] = [
  {
    id: "PET-00127",
    name: "Mochi",
    animal: "Dog",
    variant: "Pomeranian",
    ownerUserId: "USR-2026-0001",
    ownerName: "Andi Pratama",
    gender: "Male",
    dob: "2023-04-18",
    heightLength: "28 cm",
    weight: "4.2 kg",
    ...audit,
  },
  {
    id: "PET-00132",
    name: "Bruno",
    animal: "Dog",
    variant: "Golden Retriever",
    ownerUserId: "USR-2026-0002",
    ownerName: "Salsa Putri",
    gender: "Male",
    dob: "2022-05-24",
    heightLength: "58 cm",
    weight: "29.4 kg",
    ...audit,
  },
  {
    id: "PET-00300",
    name: "Gizmo 001",
    animal: "Sugar Glider",
    variant: "Classic Grey",
    ownerUserId: "USR-2026-0003",
    ownerName: "Bima Setiawan",
    gender: "Female",
    dob: "2024-02-11",
    heightLength: "24 cm",
    weight: "0.115 kg",
    ...audit,
  },
];
