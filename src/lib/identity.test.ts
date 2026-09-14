import { describe, it, expect } from "vitest";
import { initials, generateUniqueSlug } from "./identity";

describe("initials", () => {
  it("builds initials from the first two words", () => {
    expect(initials("Andi Pratama", "U")).toBe("AP");
    expect(initials("Mochi", "P")).toBe("M");
    expect(initials("", "B")).toBe("B");
    expect(initials("  ", "B")).toBe("B");
  });
});

describe("generateUniqueSlug", () => {
  it("slugifies and dedupes against taken values", () => {
    expect(generateUniqueSlug("Andi Pratama", [])).toBe("andipratama");
    expect(generateUniqueSlug("andi.pratama", ["andi.pratama"])).toBe("andi.pratama1");
  });
  it("falls back to 'user' for an empty base", () => {
    expect(generateUniqueSlug("", [])).toBe("user");
  });
});
