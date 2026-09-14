import { describe, it, expect } from "vitest";
import {
  isDuplicateBrandName,
  brandInitials,
  canModifyAssignment,
  isDuplicateAssignment,
} from "./brand-rules";

describe("isDuplicateBrandName", () => {
  const brands = [{ id: "BRD-1", name: "PawFuel" }];
  it("flags a reused name on another brand", () => {
    expect(isDuplicateBrandName(brands, { id: "BRD-2", name: "pawfuel" })).toBe(
      true,
    );
  });
  it("ignores the record being edited", () => {
    expect(isDuplicateBrandName(brands, { id: "BRD-1", name: "PawFuel" })).toBe(
      false,
    );
  });
});

describe("brandInitials", () => {
  it("builds initials from the first two words", () => {
    expect(brandInitials("Happy Tail Nutrition")).toBe("HT");
    expect(brandInitials("PawFuel")).toBe("P");
    expect(brandInitials("")).toBe("B");
  });
});

describe("canModifyAssignment", () => {
  it("only allows changes while the event is Pending", () => {
    expect(canModifyAssignment("Pending")).toBe(true);
    expect(canModifyAssignment("Open")).toBe(false);
    expect(canModifyAssignment("Closed")).toBe(false);
    expect(canModifyAssignment(undefined)).toBe(false);
  });
});

describe("isDuplicateAssignment", () => {
  it("detects the same brand already assigned to the same event", () => {
    const assignments = [
      { id: "ASN-1", name: "ASN-1", sponsorId: "BRD-1", eventId: "EVT-1" },
    ];
    expect(isDuplicateAssignment(assignments, "BRD-1", "EVT-1")).toBe(true);
    expect(isDuplicateAssignment(assignments, "BRD-1", "EVT-2")).toBe(false);
    expect(isDuplicateAssignment(assignments, "BRD-2", "EVT-1")).toBe(false);
  });
});
