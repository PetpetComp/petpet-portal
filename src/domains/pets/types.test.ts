import { describe, expect, it } from "vitest";
import {
  fromApi,
  morphsForSpecies,
  petListParams,
  petPageFromApi,
  speciesMorphLine,
  withMasterNames,
  type ApiPet,
  type PetMorph,
  type Species,
} from "./types";
import { petFixture } from "@/test/pet-fixtures";

const apiPet = (over: Partial<ApiPet> = {}): ApiPet => ({
  uuid: "p1",
  species_uuid: "sp-1",
  morph_uuid: "m-1",
  registration_number: null,
  name: "Mochi",
  gender: "Female",
  birth_date: "2023-04-25",
  height_cm: "12.50",
  weight_grams: "130.00",
  welfare_status: "PENDING",
  ...over,
});

describe("fromApi", () => {
  it("maps snake_case to camelCase and decimal strings to numbers", () => {
    expect(fromApi(apiPet())).toMatchObject({
      id: "p1",
      name: "Mochi",
      speciesId: "sp-1",
      morphId: "m-1",
      heightCm: 12.5,
      weightGrams: 130,
      birthDate: "2023-04-25",
    });
  });

  it("copes with the backend that sends no owner, names or actions", () => {
    const pet = fromApi(apiPet());
    expect(pet.ownerId).toBeNull();
    expect(pet.ownerName).toBe("");
    expect(pet.speciesName).toBe("");
    expect(pet.actions).toEqual({ update: true, delete: true });
  });

  it("reads owner, names and actions when the contract sends them", () => {
    const pet = fromApi(
      apiPet({
        owner_uuid: "u1",
        owner_name: "Andi Pratama",
        species_name: "Sugar Glider",
        morph_name: "Caramel",
        actions: { update: true, delete: false },
      }),
    );
    expect(pet).toMatchObject({
      ownerId: "u1",
      ownerName: "Andi Pratama",
      speciesName: "Sugar Glider",
      morphName: "Caramel",
      actions: { update: true, delete: false },
    });
  });

  it("turns empty or broken numbers into null", () => {
    const pet = fromApi(apiPet({ height_cm: null, weight_grams: "abc" }));
    expect(pet.heightCm).toBeNull();
    expect(pet.weightGrams).toBeNull();
  });
});

describe("petPageFromApi", () => {
  it("maps a paged response", () => {
    const page = petPageFromApi(
      {
        items: [apiPet()],
        meta: { current_page: 2, per_page: 8, total: 11, last_page: 2 },
      },
      { page: 2, perPage: 8 },
    );
    expect(page.items).toHaveLength(1);
    expect(page.meta).toEqual({
      currentPage: 2,
      perPage: 8,
      total: 11,
      lastPage: 2,
    });
  });

  it("slices the flat array the real backend sends today", () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      apiPet({ uuid: `p${i + 1}`, name: `Pet ${i + 1}` }),
    );
    const second = petPageFromApi(rows, { page: 2, perPage: 8 });
    expect(second.items.map((p) => p.id)).toEqual(["p9", "p10", "p11"]);
    expect(second.meta).toEqual({
      currentPage: 2,
      perPage: 8,
      total: 11,
      lastPage: 2,
    });
  });

  it("gives one empty page for an empty array", () => {
    expect(petPageFromApi([], { page: 1, perPage: 8 }).meta.lastPage).toBe(1);
  });
});

describe("petListParams", () => {
  it("maps names and trims the search text", () => {
    expect(
      petListParams({
        q: "  mochi ",
        speciesId: "sp-1",
        sort: "name",
        direction: "asc",
        page: 2,
        perPage: 8,
      }),
    ).toEqual({
      q: "mochi",
      species_id: "sp-1",
      owner_id: undefined,
      sort: "name",
      direction: "asc",
      page: 2,
      per_page: 8,
    });
  });
});

describe("morphsForSpecies", () => {
  const morphs: PetMorph[] = [
    { id: "m1", speciesId: "sp-1", code: "A", name: "Classic Grey" },
    { id: "m2", speciesId: "sp-2", code: "B", name: "Persian" },
    { id: "m3", speciesId: "sp-1", code: "C", name: "Mosaic" },
  ];

  it("keeps only the morphs of the chosen species", () => {
    expect(morphsForSpecies(morphs, "sp-1").map((m) => m.id)).toEqual([
      "m1",
      "m3",
    ]);
  });

  it("returns nothing until a species is chosen", () => {
    expect(morphsForSpecies(morphs, "")).toEqual([]);
  });
});

describe("withMasterNames", () => {
  const species: Species[] = [
    { id: "sp-1", code: "SUGAR_GLIDER", name: "Sugar Glider" },
  ];
  const morphs: PetMorph[] = [
    { id: "m-1", speciesId: "sp-1", code: "CARAMEL", name: "Caramel" },
  ];

  it("fills empty names from the master lists", () => {
    const pet = withMasterNames(fromApi(apiPet()), species, morphs);
    expect(pet.speciesName).toBe("Sugar Glider");
    expect(pet.morphName).toBe("Caramel");
  });

  it("keeps names the API already sent and leaves unknown ids empty", () => {
    const pet = withMasterNames(
      petFixture({ speciesName: "Own", morphId: "unknown", morphName: "" }),
      species,
      morphs,
    );
    expect(pet.speciesName).toBe("Own");
    expect(pet.morphName).toBe("");
  });
});

describe("speciesMorphLine", () => {
  it("joins the parts that exist", () => {
    expect(
      speciesMorphLine({ speciesName: "Sugar Glider", morphName: "Caramel" }),
    ).toBe("Sugar Glider · Caramel");
    expect(
      speciesMorphLine({ speciesName: "Sugar Glider", morphName: "" }),
    ).toBe("Sugar Glider");
  });
});
