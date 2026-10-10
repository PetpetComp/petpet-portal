import { describe, expect, it } from "vitest";
import {
  buildCreateEventBody,
  hasErrors,
  isValidEmail,
  organizerDisplayName,
  picDisplayName,
  picInvitationEmail,
  validateOrganizerStep,
  type PicChoice,
} from "./create-flow";
import { eventDetailsSchema } from "./schema";

const details = eventDetailsSchema.parse({
  name: "Paw Race",
  startAt: "2026-09-04T10:00",
  endAt: "2026-09-04T20:00",
  venueName: "Grand City",
  venueAddress: "",
  tagline: "",
});
const existing = { kind: "existing", id: "o1", name: "East Java" } as const;
const user: PicChoice = {
  kind: "user",
  id: "u1",
  name: "Salsa Putri",
  email: "salsa@example.com",
  isMember: true,
};

describe("validateOrganizerStep", () => {
  it("needs an organizer", () => {
    expect(validateOrganizerStep(null, null).organizer).toBeDefined();
    expect(hasErrors(validateOrganizerStep(existing, null))).toBe(false);
  });
  it("needs a name for a new organization", () => {
    expect(
      validateOrganizerStep({ kind: "new", name: "  " }, null).organizer,
    ).toBeDefined();
    expect(
      hasErrors(validateOrganizerStep({ kind: "new", name: "Pet Club" }, null)),
    ).toBe(false);
  });
  it("lets the PIC stay empty", () => {
    expect(hasErrors(validateOrganizerStep(existing, null))).toBe(false);
  });
  it("rejects an invited PIC with a bad email", () => {
    expect(
      validateOrganizerStep(existing, { kind: "invite", email: "nope" }).pic,
    ).toBeDefined();
    expect(
      hasErrors(
        validateOrganizerStep(existing, { kind: "invite", email: "a@b.co" }),
      ),
    ).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("checks the shape and ignores surrounding spaces", () => {
    expect(isValidEmail(" a@b.co ")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("buildCreateEventBody", () => {
  it("sends organization_id for an existing organization", () => {
    const body = buildCreateEventBody(details, existing);
    expect(body).toMatchObject({
      name: "Paw Race",
      organization_id: "o1",
      timezone: "Asia/Jakarta",
      venue_name: "Grand City",
    });
    expect(body).not.toHaveProperty("new_organization");
  });
  it("sends new_organization for a new one", () => {
    const body = buildCreateEventBody(details, {
      kind: "new",
      name: " Pet Club ",
    });
    expect(body.new_organization).toEqual({ name: "Pet Club" });
    expect(body).not.toHaveProperty("organization_id");
  });
});

describe("PIC helpers", () => {
  it("returns the email to invite, or null without a PIC", () => {
    expect(picInvitationEmail(null)).toBeNull();
    expect(picInvitationEmail(user)).toBe("salsa@example.com");
    expect(picInvitationEmail({ kind: "invite", email: " x@y.co " })).toBe(
      "x@y.co",
    );
  });
  it("names the PIC and the organizer for the side panels", () => {
    expect(picDisplayName(user)).toBe("Salsa Putri");
    expect(picDisplayName(null)).toBe("No PIC yet");
    expect(organizerDisplayName({ kind: "new", name: "Pet Club" })).toBe(
      "Pet Club (new)",
    );
    expect(organizerDisplayName(null)).toBe("the organizer");
  });
});
