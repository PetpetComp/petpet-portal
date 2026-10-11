import { describe, expect, it } from "vitest";
import {
  ageWeightLine,
  avatarTone,
  formatHeight,
  formatWeight,
  petAgeLabel,
  petInitial,
} from "./format";

// 10 Okt 2026 (bulan di Date dimulai dari 0).
const NOW = new Date(2026, 9, 10, 12, 0);

describe("petAgeLabel", () => {
  it("counts whole years", () => {
    expect(petAgeLabel("2023-10-10", NOW)).toBe("3 yrs");
    expect(petAgeLabel("2025-10-10", NOW)).toBe("1 yr");
  });

  it("does not round up before the birthday", () => {
    expect(petAgeLabel("2023-10-11", NOW)).toBe("2 yrs");
  });

  it("shows months under a year and a floor under a month", () => {
    expect(petAgeLabel("2026-05-10", NOW)).toBe("5 mos");
    expect(petAgeLabel("2026-09-10", NOW)).toBe("1 mo");
    expect(petAgeLabel("2026-10-01", NOW)).toBe("< 1 mo");
  });

  it("returns empty for missing, broken or future dates", () => {
    expect(petAgeLabel("", NOW)).toBe("");
    expect(petAgeLabel("not-a-date", NOW)).toBe("");
    expect(petAgeLabel("2027-01-01", NOW)).toBe("");
  });
});

describe("formatWeight and formatHeight", () => {
  it("uses grams below 1000 and kilograms above", () => {
    expect(formatWeight(130)).toBe("130 g");
    expect(formatWeight(130.56)).toBe("130.6 g");
    expect(formatWeight(4200)).toBe("4.2 kg");
    expect(formatWeight(null)).toBe("");
  });

  it("formats height in cm", () => {
    expect(formatHeight(38)).toBe("38 cm");
    expect(formatHeight(null)).toBe("");
  });
});

describe("ageWeightLine", () => {
  it("joins age and weight with a dot", () => {
    expect(
      ageWeightLine({ birthDate: "2023-10-10", weightGrams: 130 }, NOW),
    ).toBe("3 yrs · 130 g");
  });

  it("skips what is unknown and falls back to a dash", () => {
    expect(ageWeightLine({ birthDate: "", weightGrams: 130 }, NOW)).toBe(
      "130 g",
    );
    expect(ageWeightLine({ birthDate: "", weightGrams: null }, NOW)).toBe("-");
  });
});

describe("petInitial and avatarTone", () => {
  it("takes the first letter in upper case", () => {
    expect(petInitial("mochi")).toBe("M");
    expect(petInitial("  ")).toBe("?");
  });

  it("gives the same tone to the same key", () => {
    expect(avatarTone("Sugar Glider")).toBe(avatarTone("Sugar Glider"));
    expect(avatarTone("")).toContain("bg-");
  });
});
