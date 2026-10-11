import { describe, expect, it } from "vitest";
import {
  EMPTY_PET_FORM,
  formFromPet,
  formToApiBody,
  isEmptyOrValidDate,
  petFormSchema,
  serverErrorsToFormErrors,
} from "./schema";
import { petFixture } from "@/test/pet-fixtures";

const valid = { ...EMPTY_PET_FORM, name: "Mochi", speciesId: "sp-1" };

/** Pesan galat per field dari hasil validasi. */
function errorsOf(values: typeof EMPTY_PET_FORM) {
  const result = petFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((i) => [String(i.path[0]), i.message]),
  );
}

describe("petFormSchema", () => {
  it("accepts the minimum: name and species", () => {
    expect(petFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires name and species", () => {
    expect(errorsOf(EMPTY_PET_FORM)).toMatchObject({
      name: "Pet name is required.",
      speciesId: "Species is required.",
    });
  });

  it("applies the backend length limits", () => {
    expect(errorsOf({ ...valid, name: "x".repeat(151) }).name).toMatch(
      /at most 150/,
    );
    expect(
      errorsOf({ ...valid, registrationNumber: "x".repeat(101) })
        .registrationNumber,
    ).toMatch(/at most 100/i);
    expect(errorsOf({ ...valid, gender: "x".repeat(21) }).gender).toMatch(
      /at most 20/i,
    );
  });

  it("rejects negative or non-numeric height and weight, accepts empty", () => {
    expect(errorsOf({ ...valid, heightCm: "-1" }).heightCm).toBeDefined();
    expect(
      errorsOf({ ...valid, weightGrams: "abc" }).weightGrams,
    ).toBeDefined();
    expect(errorsOf({ ...valid, heightCm: "0", weightGrams: "130.5" })).toEqual(
      {},
    );
  });

  it("rejects dates that do not exist", () => {
    expect(isEmptyOrValidDate("2023-02-30")).toBe(false);
    expect(isEmptyOrValidDate("2023-02-28")).toBe(true);
    expect(isEmptyOrValidDate("")).toBe(true);
    expect(errorsOf({ ...valid, birthDate: "02/03/2023" }).birthDate).toBe(
      "Enter a valid date.",
    );
  });
});

describe("formToApiBody", () => {
  const form = petFormSchema.parse({
    ...valid,
    morphId: "m-1",
    gender: "Female",
    birthDate: "2023-04-25",
    heightCm: "12.5",
    weightGrams: "130",
    registrationNumber: "REG-1",
    ownerId: "u-1",
  });

  it("sends numbers as numbers and classification when asked", () => {
    expect(
      formToApiBody(form, { includeClassification: true, includeOwner: false }),
    ).toEqual({
      name: "Mochi",
      species_id: "sp-1",
      morph_id: "m-1",
      registration_number: "REG-1",
      gender: "Female",
      birth_date: "2023-04-25",
      height_cm: 12.5,
      weight_grams: 130,
    });
  });

  it("omits species, morph and owner when the backend does not take them", () => {
    const body = formToApiBody(form, {
      includeClassification: false,
      includeOwner: false,
    });
    expect(body).not.toHaveProperty("species_id");
    expect(body).not.toHaveProperty("morph_id");
    expect(body).not.toHaveProperty("owner_id");
  });

  it("sends owner_id only when allowed and filled", () => {
    const options = { includeClassification: true, includeOwner: true };
    expect(formToApiBody(form, options).owner_id).toBe("u-1");
    expect(formToApiBody({ ...form, ownerId: "" }, options)).not.toHaveProperty(
      "owner_id",
    );
  });

  it("turns empty optional text into null so Edit can clear it", () => {
    const body = formToApiBody(petFormSchema.parse(valid), {
      includeClassification: true,
      includeOwner: false,
    });
    expect(body).toMatchObject({
      morph_id: null,
      registration_number: null,
      gender: null,
      birth_date: null,
      height_cm: null,
      weight_grams: null,
    });
  });
});

describe("formFromPet", () => {
  it("fills the form from a pet and writes empty text for unknowns", () => {
    const values = formFromPet(
      petFixture({ morphId: null, heightCm: null, weightGrams: 130 }),
    );
    expect(values).toMatchObject({
      name: "Mochi",
      morphId: "",
      heightCm: "",
      weightGrams: "130",
    });
  });
});

describe("serverErrorsToFormErrors", () => {
  it("maps API field names to form field names", () => {
    expect(
      serverErrorsToFormErrors({
        species_id: ["The selected species id is invalid."],
        registration_number: ["Taken.", "Really."],
        something_else: ["ignored"],
      }),
    ).toEqual({
      speciesId: "The selected species id is invalid.",
      registrationNumber: "Taken. Really.",
    });
    expect(serverErrorsToFormErrors(undefined)).toEqual({});
  });
});
