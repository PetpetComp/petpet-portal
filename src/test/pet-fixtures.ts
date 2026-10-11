import type { Pet, PetPage } from "@/domains/pets/types";

/** Bentuk layar sebuah pet untuk tes. Timpa field yang dibutuhkan lewat `over`. */
export function petFixture(over: Partial<Pet> = {}): Pet {
  return {
    id: "p1",
    name: "Mochi",
    ownerId: "u1",
    ownerName: "Andi Pratama",
    speciesId: "sp-sugar-glider",
    speciesName: "Sugar Glider",
    morphId: "morph-caramel",
    morphName: "Caramel",
    registrationNumber: "",
    gender: "Female",
    birthDate: "2023-04-25",
    heightCm: null,
    weightGrams: 130,
    welfareStatus: "PENDING",
    actions: { update: true, delete: true },
    ...over,
  };
}

/** Satu halaman list pet untuk tes. */
export function petPageFixture(
  items: Pet[],
  total = items.length,
  perPage = 8,
): PetPage {
  return {
    items,
    meta: {
      currentPage: 1,
      perPage,
      total,
      lastPage: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}
