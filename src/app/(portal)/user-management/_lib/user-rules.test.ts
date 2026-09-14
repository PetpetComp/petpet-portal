import { describe, it, expect } from "vitest";
import {
  isValidPhone,
  isValidEmail,
  isDuplicateContact,
  hasLinkedRecords,
  generateUsername,
  userInitials,
} from "./user-rules";

describe("isValidPhone", () => {
  it("accepts 8-15 digit numbers only", () => {
    expect(isValidPhone("081234567890")).toBe(true);
    expect(isValidPhone("1234567")).toBe(false);
    expect(isValidPhone("12345678901234567")).toBe(false);
    expect(isValidPhone("0812-3456")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("allows empty (optional) and rejects malformed values", () => {
    expect(isValidEmail("")).toBe(true);
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("isDuplicateContact", () => {
  const users = [
    { id: "USR-1", name: "A", email: "a@x.com", phone: "0811" },
    { id: "USR-2", name: "B", email: "b@x.com", phone: "0822" },
  ];
  it("flags a reused email or phone on another user", () => {
    expect(
      isDuplicateContact(users, {
        id: "USR-3",
        name: "C",
        email: "A@X.COM",
        phone: "0833",
      }),
    ).toBe(true);
    expect(
      isDuplicateContact(users, {
        id: "USR-3",
        name: "C",
        email: "c@x.com",
        phone: "0811",
      }),
    ).toBe(true);
  });
  it("ignores the record being edited", () => {
    expect(
      isDuplicateContact(users, {
        id: "USR-1",
        name: "A",
        email: "a@x.com",
        phone: "0811",
      }),
    ).toBe(false);
  });
});

describe("hasLinkedRecords", () => {
  it("detects a linked pet, registration, committee, brand, or prize", () => {
    const empty = { pets: [], registrations: [], committee: [], brands: [], prizes: [] };
    expect(hasLinkedRecords(empty, "USR-1")).toBe(false);
    expect(
      hasLinkedRecords(
        { ...empty, pets: [{ id: "P", name: "P", ownerUserId: "USR-1" }] },
        "USR-1",
      ),
    ).toBe(true);
    expect(
      hasLinkedRecords(
        {
          ...empty,
          prizes: [{ id: "PZ", name: "PZ", winnerUserIds: "USR-1,USR-2" }],
        },
        "USR-1",
      ),
    ).toBe(true);
  });
});

describe("generateUsername", () => {
  it("builds a lowercase slug and dedupes against existing usernames", () => {
    const existing = [{ id: "1", name: "1", username: "andi.pratama" }];
    expect(generateUsername("Salsa", "Putri", existing)).toBe("salsa.putri");
    expect(generateUsername("Andi", "Pratama", existing)).toBe("andi.pratama1");
  });
});

describe("userInitials", () => {
  it("builds initials from first and last name", () => {
    expect(userInitials("Andi", "Pratama")).toBe("AP");
    expect(userInitials("Andi", "")).toBe("A");
    expect(userInitials("", "")).toBe("U");
  });
});
