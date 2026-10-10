import { describe, expect, it } from "vitest";
import {
  EVENT_TARGET_VALUE,
  createInviteSchema,
  inviteToApiBody,
  serverErrorsToInviteErrors,
  targetFromValue,
} from "./schema";
import { FALLBACK_ASSIGNMENT_ROLES, roleFromApi } from "./types";

const roles = FALLBACK_ASSIGNMENT_ROLES.map(roleFromApi);
const schema = createInviteSchema(roles);

/** Pesan error pertama per field untuk satu isian form. */
function messages(values: Record<string, string>) {
  const result = schema.safeParse(values);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    if (!(field in out)) out[field] = issue.message;
  }
  return out;
}

describe("createInviteSchema", () => {
  it("accepts the event team with Event manager", () => {
    expect(
      schema.safeParse({
        target: EVENT_TARGET_VALUE,
        role: "EVENT_MANAGER",
        email: " pic@example.com ",
      }).success,
    ).toBe(true);
  });
  it("accepts a competition with Judge", () => {
    expect(
      schema.safeParse({ target: "c1", role: "JUDGE", email: "j@example.com" })
        .success,
    ).toBe(true);
  });
  it("asks for target, role and a person when empty", () => {
    expect(messages({ target: "", role: "", email: "" })).toEqual({
      target: "Choose where this person will work.",
      role: "Choose a role.",
      email: "Choose a person or enter an email address.",
    });
  });
  it("rejects a malformed email", () => {
    expect(
      messages({ target: "c1", role: "JUDGE", email: "not-an-email" }).email,
    ).toBe("Enter a valid email address.");
  });
  it("rejects a role that does not fit the target scope", () => {
    expect(
      messages({ target: "c1", role: "EVENT_MANAGER", email: "a@b.co" }).role,
    ).toMatch(/not available/);
    expect(
      messages({ target: EVENT_TARGET_VALUE, role: "JUDGE", email: "a@b.co" })
        .role,
    ).toMatch(/not available/);
  });
  it("rejects an inactive role", () => {
    const inactive = createInviteSchema(
      roles.map((r) => (r.code === "JUDGE" ? { ...r, isActive: false } : r)),
    );
    expect(
      inactive.safeParse({ target: "c1", role: "JUDGE", email: "a@b.co" })
        .success,
    ).toBe(false);
  });
});

describe("inviteToApiBody", () => {
  it("omits competition_id for the event team and trims the email", () => {
    expect(
      inviteToApiBody("e1", {
        target: EVENT_TARGET_VALUE,
        role: "EVENT_MANAGER",
        email: " pic@example.com ",
      }),
    ).toEqual({
      event_id: "e1",
      email: "pic@example.com",
      assignment_role: "EVENT_MANAGER",
    });
  });
  it("sends competition_id for a competition", () => {
    expect(
      inviteToApiBody("e1", { target: "c1", role: "JUDGE", email: "j@x.co" }),
    ).toEqual({
      event_id: "e1",
      competition_id: "c1",
      email: "j@x.co",
      assignment_role: "JUDGE",
    });
  });
});

describe("targetFromValue and serverErrorsToInviteErrors", () => {
  it("decodes the dropdown value", () => {
    expect(targetFromValue(EVENT_TARGET_VALUE)).toEqual({ kind: "event" });
    expect(targetFromValue("c9")).toEqual({
      kind: "competition",
      competitionId: "c9",
    });
  });
  it("maps API fields to form fields and ignores unknown ones", () => {
    expect(
      serverErrorsToInviteErrors({
        assignment_role: ["Bad role."],
        email: ["Taken.", "Twice."],
        competition_id: ["Wrong event."],
        event_id: ["ignored"],
      }),
    ).toEqual({
      role: "Bad role.",
      email: "Taken. Twice.",
      target: "Wrong event.",
    });
    expect(serverErrorsToInviteErrors(undefined)).toEqual({});
  });
});
