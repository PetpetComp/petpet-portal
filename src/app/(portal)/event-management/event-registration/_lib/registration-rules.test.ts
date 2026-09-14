import { describe, it, expect } from "vitest";
import {
  resolvePriceCategory,
  isDuplicateRegistration,
  isAnimalMismatch,
} from "./registration-rules";

describe("resolvePriceCategory", () => {
  const competition = {
    id: "CMP-1",
    name: "CMP-1",
    earlyBirdOpen: "2026-01-01T00:00:00Z",
    earlyBirdClose: "2026-01-10T00:00:00Z",
    earlyBirdPrice: "50000",
    onlineOpen: "2026-01-11T00:00:00Z",
    onlineClose: "2026-02-01T00:00:00Z",
    onlinePrice: "70000",
    otsOpen: "2026-02-02T00:00:00Z",
    otsClose: "2026-02-05T00:00:00Z",
    otsPrice: "90000",
  };
  it("picks the channel whose window contains the given date", () => {
    expect(resolvePriceCategory(competition, new Date("2026-01-05T00:00:00Z"))).toEqual({
      category: "Early Bird",
      fee: 50000,
    });
    expect(resolvePriceCategory(competition, new Date("2026-01-15T00:00:00Z"))).toEqual({
      category: "Online",
      fee: 70000,
    });
  });
  it("falls back to OTS when no window matches", () => {
    expect(resolvePriceCategory(competition, new Date("2026-03-01T00:00:00Z"))).toEqual({
      category: "OTS",
      fee: 90000,
    });
  });
});

describe("isDuplicateRegistration", () => {
  const registrations = [
    { id: "REG-1", name: "REG-1", petId: "PET-1", competitionId: "CMP-1" },
  ];
  it("flags the same pet already registered for the competition", () => {
    expect(
      isDuplicateRegistration(registrations, {
        id: "REG-2",
        name: "REG-2",
        petId: "PET-1",
        competitionId: "CMP-1",
      }),
    ).toBe(true);
  });
  it("ignores the record being edited", () => {
    expect(
      isDuplicateRegistration(registrations, {
        id: "REG-1",
        name: "REG-1",
        petId: "PET-1",
        competitionId: "CMP-1",
      }),
    ).toBe(false);
  });
});

describe("isAnimalMismatch", () => {
  it("flags when the pet's animal differs from the competition's animal", () => {
    expect(
      isAnimalMismatch({ id: "P", name: "P", animal: "Cat" }, { id: "C", name: "C", animal: "Dog" }),
    ).toBe(true);
    expect(
      isAnimalMismatch({ id: "P", name: "P", animal: "Dog" }, { id: "C", name: "C", animal: "Dog" }),
    ).toBe(false);
  });
});
