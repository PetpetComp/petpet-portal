import { describe, it, expect } from "vitest";
import { isDuplicatePet, hasActiveRegistration, petInitials } from "./pet-rules";
import { calculateAge } from "@/lib/format/date";

const pets = [
  { id: "PET-1", name: "Mochi" },
  { id: "PET-2", name: "Bruno" },
];

describe("isDuplicatePet", () => {
  it("flags a name already in use", () => {
    expect(isDuplicatePet(pets, { id: "PET-3", name: "mochi" })).toBe(true);
  });
  it("ignores the record being edited", () => {
    expect(isDuplicatePet(pets, { id: "PET-1", name: "Mochi" })).toBe(false);
  });
});

describe("hasActiveRegistration", () => {
  it("detects a pet already registered", () => {
    const registrations = [{ id: "REG-1", name: "REG-1", petId: "PET-1" }];
    expect(hasActiveRegistration(registrations, "PET-1")).toBe(true);
    expect(hasActiveRegistration(registrations, "PET-2")).toBe(false);
  });
});

describe("petInitials", () => {
  it("builds initials from the first two words", () => {
    expect(petInitials("Mochi Cool")).toBe("MC");
    expect(petInitials("Bruno")).toBe("B");
    expect(petInitials("")).toBe("P");
  });
});

describe("calculateAge", () => {
  it("returns '-' for missing or invalid dates", () => {
    expect(calculateAge("")).toBe("-");
    expect(calculateAge("not-a-date")).toBe("-");
  });
  it("reports whole years for older pets", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(calculateAge(twoYearsAgo.toISOString())).toBe("2 years");
  });
  it("reports months for pets under a year old", () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    expect(calculateAge(threeMonthsAgo.toISOString())).toBe("3 months");
  });
});
