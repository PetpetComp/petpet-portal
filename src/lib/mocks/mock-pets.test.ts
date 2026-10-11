import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  createPetRecord,
  deletePetRecord,
  getPetRecord,
  listPetMorphRecords,
  listPetRecords,
  updatePetRecord,
} from "./mock-pets";
import { store } from "./mock-store";
import type { MockUser } from "./mock-types";

const userBy = (email: string) =>
  store.users.find((u) => u.email === email) as MockUser;
/** Super admin: punya `user.view` dan `user.manage`. */
const admin = userBy("admin@petpet.dev");
/** Pemilik pet-bolt dan pet-luna, tanpa hak staf. */
const competitor = userBy("competitor@petpet.dev");
/** User lain tanpa hak staf. */
const stranger = userBy("sari.wulandari@petpet.dev");

const SUGAR_GLIDER = "sp-sugar-glider";
/** Pet seed yang punya entry kompetisi dan milik u-competitor. */
const PET_WITH_ENTRY = "pet-luna";
/** Pet seed milik u-competitor yang dipakai untuk baca dan ubah (tes tidak menghapusnya). */
const PET_WITHOUT_ENTRY = "pet-bolt";

/** Membuat pet baru milik competitor: pasti tanpa entry kompetisi, aman dihapus di tes. */
const newPetOfCompetitor = () =>
  createPetRecord(competitor, { name: "Temp", species_id: SUGAR_GLIDER });

const snapshot = store.pets.map((pet) => ({ ...pet }));
afterEach(() => {
  // Kembalikan data seed: tes di bawah menambah/mengubah/menghapus pet.
  store.pets = snapshot.map((pet) => ({ ...pet }));
});

const query = (params: Record<string, string> = {}) =>
  new URLSearchParams(params);

/** Menjalankan fungsi dan mengembalikan ApiError yang dilempar (gagal bila tidak melempar). */
function failure(run: () => unknown): ApiError {
  try {
    run();
  } catch (cause) {
    if (cause instanceof ApiError) return cause;
    throw cause;
  }
  throw new Error("Expected an ApiError");
}

describe("listPetRecords", () => {
  it("returns pages with meta and the enriched pet shape", () => {
    const page = listPetRecords(admin, query({ per_page: "8" }));
    expect(page.items).toHaveLength(8);
    expect(page.meta).toMatchObject({
      current_page: 1,
      per_page: 8,
      total: store.pets.length,
    });
    expect(page.items[0]).toMatchObject({
      species_name: "Sugar Glider",
      welfare_status: "PENDING",
      actions: { update: true },
    });
    expect(typeof page.items[0].owner_name).toBe("string");
  });

  it("shows staff every pet but ordinary users only their own", () => {
    const own = listPetRecords(competitor, query({ per_page: "100" }));
    expect(own.items.map((p) => p.uuid).sort()).toEqual([
      "pet-bolt",
      "pet-luna",
    ]);
    const all = listPetRecords(admin, query({ per_page: "100" }));
    expect(all.meta.total).toBe(store.pets.length);
  });

  it("searches pet name, registration number and owner", () => {
    const names = (q: string) =>
      listPetRecords(admin, query({ q, per_page: "100" })).items.map(
        (p) => p.name,
      );
    expect(names("bolt")).toEqual(["Bolt"]);
    expect(names("sari wulandari").sort()).toEqual(["Coco", "Milo"]);
    expect(names("zzzz")).toEqual([]);
  });

  it("filters by species and rejects an unknown species", () => {
    expect(
      listPetRecords(admin, query({ species_id: SUGAR_GLIDER })).meta.total,
    ).toBe(store.pets.length);
    expect(
      failure(() => listPetRecords(admin, query({ species_id: "nope" })))
        .status,
    ).toBe(422);
  });

  it("sorts by name in both directions", () => {
    const first = (direction: string) =>
      listPetRecords(admin, query({ sort: "name", direction })).items[0].name;
    const asc = first("asc");
    const desc = first("desc");
    expect(asc.localeCompare(desc)).toBeLessThan(0);
  });

  it("rejects unknown sort and too large per_page", () => {
    expect(
      failure(() => listPetRecords(admin, query({ sort: "weight" }))).status,
    ).toBe(422);
    expect(
      failure(() => listPetRecords(admin, query({ per_page: "500" }))).status,
    ).toBe(422);
  });
});

describe("getPetRecord", () => {
  it("lets the owner and staff read, and refuses others with 403", () => {
    expect(getPetRecord(competitor, PET_WITHOUT_ENTRY).name).toBe("Bolt");
    expect(getPetRecord(admin, PET_WITHOUT_ENTRY).uuid).toBe(PET_WITHOUT_ENTRY);
    expect(
      failure(() => getPetRecord(stranger, PET_WITHOUT_ENTRY)).status,
    ).toBe(403);
  });

  it("answers 404 for an unknown pet", () => {
    expect(failure(() => getPetRecord(admin, "nope")).status).toBe(404);
  });

  it("turns delete off in actions when the pet has entries", () => {
    expect(getPetRecord(competitor, PET_WITH_ENTRY).actions).toEqual({
      update: true,
      delete: false,
    });
    const fresh = newPetOfCompetitor();
    expect(getPetRecord(competitor, fresh.uuid).actions?.delete).toBe(true);
  });
});

describe("createPetRecord", () => {
  const body = { name: " Pico ", species_id: SUGAR_GLIDER };

  it("creates a pet owned by the caller with decimal strings", () => {
    const pet = createPetRecord(stranger, {
      ...body,
      morph_id: "morph-mosaic",
      weight_grams: 130,
      height_cm: 12.5,
      birth_date: "2024-01-15",
    });
    expect(pet).toMatchObject({
      name: "Pico",
      owner_uuid: stranger.uuid,
      morph_uuid: "morph-mosaic",
      weight_grams: "130.00",
      height_cm: "12.50",
      birth_date: "2024-01-15",
      welfare_status: "PENDING",
    });
    expect(store.pets.some((p) => p.uuid === pet.uuid)).toBe(true);
  });

  it("requires name and species with a field error", () => {
    const error = failure(() => createPetRecord(stranger, {}));
    expect(error.status).toBe(422);
    expect(error.errors).toMatchObject({
      name: expect.any(Array),
    });
    const noSpecies = failure(() => createPetRecord(stranger, { name: "A" }));
    expect(noSpecies.errors).toHaveProperty("species_id");
  });

  it("rejects a morph that belongs to another species", () => {
    store.species.push({
      uuid: "sp-test",
      code: "TEST",
      name: "Test",
    } as (typeof store.species)[number]);
    try {
      const error = failure(() =>
        createPetRecord(stranger, {
          name: "A",
          species_id: "sp-test",
          morph_id: "morph-mosaic",
        }),
      );
      expect(error.status).toBe(422);
      expect(error.errors).toHaveProperty("morph_id");
    } finally {
      store.species = store.species.filter((s) => s.uuid !== "sp-test");
    }
  });

  it("rejects bad numbers, dates and a taken registration number", () => {
    const run = (extra: Record<string, unknown>) =>
      failure(() => createPetRecord(stranger, { ...body, ...extra }));
    expect(run({ weight_grams: -1 }).errors).toHaveProperty("weight_grams");
    expect(run({ height_cm: "abc" }).errors).toHaveProperty("height_cm");
    expect(run({ birth_date: "2023-02-30" }).errors).toHaveProperty(
      "birth_date",
    );
    expect(run({ gender: "x".repeat(21) }).errors).toHaveProperty("gender");
    createPetRecord(stranger, { ...body, registration_number: "REG-1" });
    expect(run({ registration_number: "REG-1" }).errors).toHaveProperty(
      "registration_number",
    );
  });

  it("lets only staff create a pet for another owner", () => {
    expect(
      failure(() =>
        createPetRecord(stranger, { ...body, owner_id: competitor.uuid }),
      ).status,
    ).toBe(403);
    const pet = createPetRecord(admin, { ...body, owner_id: competitor.uuid });
    expect(pet.owner_uuid).toBe(competitor.uuid);
    expect(
      failure(() => createPetRecord(admin, { ...body, owner_id: "ghost" }))
        .status,
    ).toBe(422);
  });
});

describe("updatePetRecord", () => {
  it("changes only the fields that were sent and clears with null", () => {
    const pet = updatePetRecord(competitor, PET_WITHOUT_ENTRY, {
      name: "Bolt II",
      gender: null,
    });
    expect(pet).toMatchObject({ name: "Bolt II", gender: null });
    expect(pet.birth_date).toBe("2023-02-10");
  });

  it("lets the owner and staff edit, and refuses others with 403 before 422", () => {
    expect(
      updatePetRecord(admin, PET_WITHOUT_ENTRY, { name: "Admin edit" }).name,
    ).toBe("Admin edit");
    expect(
      failure(() => updatePetRecord(stranger, PET_WITHOUT_ENTRY, { name: "" }))
        .status,
    ).toBe(403);
  });

  it("validates like create, ignoring the pet's own registration number", () => {
    updatePetRecord(competitor, PET_WITHOUT_ENTRY, {
      registration_number: "REG-9",
    });
    expect(
      updatePetRecord(competitor, PET_WITHOUT_ENTRY, {
        registration_number: "REG-9",
        name: "Same number again",
      }).registration_number,
    ).toBe("REG-9");
    expect(
      failure(() =>
        updatePetRecord(competitor, PET_WITH_ENTRY, {
          registration_number: "REG-9",
        }),
      ).errors,
    ).toHaveProperty("registration_number");
    expect(
      failure(() =>
        updatePetRecord(competitor, PET_WITHOUT_ENTRY, { name: "" }),
      ).status,
    ).toBe(422);
  });

  it("changes morph within the species and rejects an unknown morph", () => {
    expect(
      updatePetRecord(competitor, PET_WITHOUT_ENTRY, {
        species_id: SUGAR_GLIDER,
        morph_id: "morph-mosaic",
      }).morph_name,
    ).toBe("Mosaic");
    expect(
      failure(() =>
        updatePetRecord(competitor, PET_WITHOUT_ENTRY, { morph_id: "ghost" }),
      ).errors,
    ).toHaveProperty("morph_id");
  });
});

describe("deletePetRecord", () => {
  it("deletes a pet without entries", () => {
    const fresh = newPetOfCompetitor();
    expect(deletePetRecord(competitor, fresh.uuid)).toBeNull();
    expect(store.pets.some((p) => p.uuid === fresh.uuid)).toBe(false);
  });

  it("refuses a pet with entries with 422", () => {
    const error = failure(() => deletePetRecord(competitor, PET_WITH_ENTRY));
    expect(error.status).toBe(422);
    expect(error.message).toBe(
      "This pet has competition entries and cannot be deleted.",
    );
  });

  it("checks the caller first (403), then the data (422)", () => {
    expect(
      failure(() => deletePetRecord(stranger, PET_WITH_ENTRY)).status,
    ).toBe(403);
    expect(failure(() => deletePetRecord(admin, "nope")).status).toBe(404);
  });
});

describe("listPetMorphRecords", () => {
  it("returns a flat array with code, sorted by name", () => {
    const morphs = listPetMorphRecords(query());
    expect(Array.isArray(morphs)).toBe(true);
    expect(morphs[0]).toHaveProperty("species_uuid");
    expect(morphs.find((m) => m.name === "Classic Grey")?.code).toBe(
      "CLASSIC_GREY",
    );
    const names = morphs.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("filters by species and answers 404 for an unknown one", () => {
    expect(
      listPetMorphRecords(query({ species_id: SUGAR_GLIDER })).length,
    ).toBe(store.petMorphs.length);
    expect(
      failure(() => listPetMorphRecords(query({ species_id: "nope" }))).status,
    ).toBe(404);
  });
});
