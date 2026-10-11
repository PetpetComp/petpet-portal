import { describe, expect, it } from "vitest";
import {
  EMPTY_USER_FORM,
  createUserFormSchema,
  hasProfileInput,
  serverErrorsToFormErrors,
  toCreateBody,
  toProfileBody,
  toUpdateBody,
  type UserFormValues,
} from "./schema";

const valid: UserFormValues = {
  ...EMPTY_USER_FORM,
  firstName: " Salsa ",
  lastName: "",
  username: "salsa.putri",
  email: "salsa.putri@example.com",
  phone: "081234567802",
  gender: "FEMALE",
  province: "Jawa Timur",
  city: "Surabaya",
};

/** Pesan error pertama per field, atau objek kosong bila form valid. */
const messages = (mode: "create" | "edit", values: UserFormValues) => {
  const result = createUserFormSchema(mode).safeParse(values);
  if (result.success) return {};
  // Seperti react-hook-form: hanya pesan pertama per field yang tampil.
  const first: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    if (!(field in first)) first[field] = issue.message;
  }
  return first;
};

describe("createUserFormSchema", () => {
  it("starts with only the User role ticked", () => {
    expect(EMPTY_USER_FORM.roles).toEqual(["USER"]);
  });

  it("accepts a valid form and trims text", () => {
    const parsed = createUserFormSchema("create").parse(valid);
    expect(parsed.firstName).toBe("Salsa");
  });

  it("requires first name, username, email and phone on create", () => {
    expect(messages("create", EMPTY_USER_FORM)).toEqual({
      firstName: "First name is required.",
      username: "Username is required.",
      email: "Email is required.",
      phone: "Phone is required.",
    });
  });

  it("shows the design message for a bad phone", () => {
    const bad = "Numbers only, 8-15 digits.";
    expect(messages("create", { ...valid, phone: "0812345" }).phone).toBe(bad);
    expect(messages("create", { ...valid, phone: "0812-345-6789" }).phone).toBe(
      bad,
    );
    expect(messages("create", { ...valid, phone: "1".repeat(16) }).phone).toBe(
      bad,
    );
    expect(messages("create", { ...valid, phone: "12345678" })).toEqual({});
  });

  it("rejects a bad email and a username with spaces", () => {
    expect(messages("create", { ...valid, email: "nope" }).email).toBe(
      "Enter a valid email address.",
    );
    expect(messages("create", { ...valid, username: "a b" }).username).toBe(
      "Username cannot contain spaces.",
    );
  });

  it("does not validate username and email in edit mode (they are read-only)", () => {
    expect(messages("edit", { ...valid, username: "", email: "" })).toEqual({});
  });

  it("rejects an unknown gender value", () => {
    expect(
      messages("create", { ...valid, gender: "X" as never }).gender,
    ).toBeDefined();
  });
});

describe("request bodies", () => {
  const input = createUserFormSchema("create").parse(valid);

  it("builds the create body with only fields the backend accepts", () => {
    expect(toCreateBody(input)).toEqual({
      username: "salsa.putri",
      email: "salsa.putri@example.com",
      first_name: "Salsa",
      phone: "081234567802",
      roles: ["USER"],
    });
    expect(toCreateBody({ ...input, lastName: "Putri" }).last_name).toBe(
      "Putri",
    );
  });

  it("sends empty profile fields as null so they can be cleared", () => {
    expect(
      toProfileBody({ ...input, gender: "", province: "", city: "" }),
    ).toEqual({ gender: null, province: null, city: null });
    expect(toUpdateBody(input)).toEqual({
      first_name: "Salsa",
      last_name: null,
      phone: "081234567802",
      gender: "FEMALE",
      province: "Jawa Timur",
      city: "Surabaya",
    });
  });

  it("detects whether a PATCH is needed after create", () => {
    expect(hasProfileInput(input)).toBe(true);
    expect(
      hasProfileInput({ ...input, gender: "", province: "", city: "" }),
    ).toBe(false);
  });
});

describe("serverErrorsToFormErrors", () => {
  it("maps API fields to form fields and ignores unknown ones", () => {
    expect(
      serverErrorsToFormErrors({
        first_name: ["Required."],
        username: ["Taken.", "Really."],
        "roles.0": ["Invalid."],
        status: ["Ignored."],
      }),
    ).toEqual({
      firstName: "Required.",
      username: "Taken. Really.",
      roles: "Invalid.",
    });
    expect(serverErrorsToFormErrors(undefined)).toEqual({});
  });
});
