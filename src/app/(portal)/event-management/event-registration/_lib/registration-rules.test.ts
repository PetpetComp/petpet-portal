import { describe, it, expect } from "vitest";
import {
  currentPeriod,
  isDuplicateRegistration,
  periodLabel,
} from "./registration-rules";

describe("currentPeriod", () => {
  const periods = [
    {
      uuid: "P1",
      period_type: "EARLY_BIRD",
      price: 50000,
      registration_start_at: "2026-01-01T00:00:00Z",
      registration_end_at: "2026-01-10T00:00:00Z",
    },
    {
      uuid: "P2",
      period_type: "ONLINE",
      price: 70000,
      registration_start_at: "2026-01-11T00:00:00Z",
      registration_end_at: "2026-02-01T00:00:00Z",
    },
  ];
  it("picks the period whose window contains the given date", () => {
    expect(currentPeriod(periods, new Date("2026-01-05T00:00:00Z"))?.uuid).toBe(
      "P1",
    );
    expect(currentPeriod(periods, new Date("2026-01-15T00:00:00Z"))?.uuid).toBe(
      "P2",
    );
  });
  it("returns undefined when no window matches", () => {
    expect(currentPeriod(periods, new Date("2026-03-01T00:00:00Z"))).toBeUndefined();
  });
});

describe("periodLabel", () => {
  it("formats the period type and price", () => {
    expect(
      periodLabel({ period_type: "EARLY_BIRD", price: 50000 }),
    ).toBe("EARLY BIRD · Rp 50000");
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
        petId: "PET-1",
        competitionId: "CMP-1",
      }),
    ).toBe(true);
  });
  it("ignores the record being edited", () => {
    expect(
      isDuplicateRegistration(registrations, {
        id: "REG-1",
        petId: "PET-1",
        competitionId: "CMP-1",
      }),
    ).toBe(false);
  });
});
