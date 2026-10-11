import { describe, expect, it } from "vitest";
import {
  applicationSchema,
  applicationToApiBody,
  inviteSchema,
  inviteToApiBody,
  profileSchema,
  profileToApiBody,
  profileToValues,
  reviewNoteSchema,
  serverErrorsToApplicationErrors,
  serverErrorsToInviteErrors,
} from "./schema";
import { organizationFromApi } from "./types";

const VALID_APPLICATION = {
  organizationName: "  Bekasi Pet Club ",
  contactEmail: "hello@bekasipet.id",
  organizationType: "",
  description: "",
  contactPhone: "",
  address: "",
};

describe("applicationSchema", () => {
  it("accepts the minimum and trims", () => {
    const result = applicationSchema.safeParse(VALID_APPLICATION);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.organizationName).toBe("Bekasi Pet Club");
  });
  it("requires name and a valid email", () => {
    const result = applicationSchema.safeParse({
      ...VALID_APPLICATION,
      organizationName: " ",
      contactEmail: "nope",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("organizationName");
      expect(fields).toContain("contactEmail");
    }
  });
  it("enforces backend length limits", () => {
    const result = applicationSchema.safeParse({
      ...VALID_APPLICATION,
      organizationName: "a".repeat(201),
      organizationType: "b".repeat(51),
      contactPhone: "1".repeat(31),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toHaveLength(3);
  });
  it("builds a body without empty optional fields", () => {
    const parsed = applicationSchema.parse({
      ...VALID_APPLICATION,
      address: "Jl. Ahmad Yani 5",
    });
    expect(applicationToApiBody(parsed)).toEqual({
      proposed_organization_name: "Bekasi Pet Club",
      contact_email: "hello@bekasipet.id",
      address: "Jl. Ahmad Yani 5",
    });
  });
  it("maps server errors to form fields", () => {
    expect(
      serverErrorsToApplicationErrors({
        contact_email: ["Bad email."],
        unknown_field: ["ignored"],
      }),
    ).toEqual({ contactEmail: "Bad email." });
  });
});

describe("profileSchema", () => {
  const org = organizationFromApi({
    uuid: "o1",
    name: "East Java Pet Sport",
    slug: "east-java-pet-sport",
    description: null,
    email: "contact@ejps.dev",
    phone: null,
    address: null,
    status: "ACTIVE",
    sponsor_uuid: null,
  });
  it("starts from the organization with empty strings for nulls", () => {
    expect(profileToValues(org)).toEqual({
      name: "East Java Pet Sport",
      description: "",
      email: "contact@ejps.dev",
      phone: "",
      address: "",
    });
  });
  it("allows an empty email but rejects a malformed one", () => {
    const base = profileToValues(org);
    expect(profileSchema.safeParse({ ...base, email: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, email: "x" }).success).toBe(
      false,
    );
  });
  it("sends null for cleared optional fields", () => {
    const parsed = profileSchema.parse(profileToValues(org));
    expect(profileToApiBody(parsed)).toEqual({
      name: "East Java Pet Sport",
      description: null,
      email: "contact@ejps.dev",
      phone: null,
      address: null,
    });
  });
});

describe("inviteSchema", () => {
  it("accepts admin and staff only", () => {
    expect(
      inviteSchema.safeParse({ email: "a@b.co", role: "ADMIN" }).success,
    ).toBe(true);
    expect(
      inviteSchema.safeParse({ email: "a@b.co", role: "OWNER" }).success,
    ).toBe(false);
  });
  it("requires a valid email", () => {
    expect(inviteSchema.safeParse({ email: "", role: "STAFF" }).success).toBe(
      false,
    );
    expect(
      inviteSchema.safeParse({ email: "bad", role: "STAFF" }).success,
    ).toBe(false);
  });
  it("builds the API body and maps server errors", () => {
    const parsed = inviteSchema.parse({ email: " a@b.co ", role: "STAFF" });
    expect(inviteToApiBody(parsed)).toEqual({
      email: "a@b.co",
      member_role: "STAFF",
    });
    expect(serverErrorsToInviteErrors({ member_role: ["Invalid."] })).toEqual({
      role: "Invalid.",
    });
  });
});

describe("reviewNoteSchema", () => {
  it("requires a reason of at most 1000 characters", () => {
    expect(reviewNoteSchema.safeParse({ note: "  " }).success).toBe(false);
    expect(reviewNoteSchema.safeParse({ note: "ok" }).success).toBe(true);
    expect(reviewNoteSchema.safeParse({ note: "x".repeat(1001) }).success).toBe(
      false,
    );
  });
});
