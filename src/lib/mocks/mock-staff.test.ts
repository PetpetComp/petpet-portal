import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  createInvitationRecord,
  listAssignmentRoles,
  listCompetitionStaff,
  listEventStaff,
  listInvitations,
  resetStaffStore,
  revokeAssignmentRecord,
  revokeInvitationRecord,
  staffActions,
  staffStore,
} from "./mock-staff";
import { store } from "./mock-store";
import type { MockCaller } from "./mock-rules";
import type { MockUser } from "./mock-types";
import { PERMISSION } from "@/lib/auth/permissions";

const SURABAYA = "evt-surabaya-paw-race";
const JAKARTA = "evt-jakarta-pet-festival";
const PAW_RACE_100M = "comp-paw-race-100m";
const PAW_RACE_RELAY = "comp-paw-race-relay";

const userBy = (email: string) =>
  store.users.find((u) => u.email === email) as MockUser;
/** Super admin: semua permission, lintas organisasi. */
const admin = userBy("admin@petpet.dev");
/** Anggota organisasi Jakarta saja, bukan Surabaya. */
const organizer = userBy("organizer@petpet.dev");
/** User biasa tanpa organisasi. */
const competitor = userBy("competitor@petpet.dev");

const query = (params: Record<string, string> = {}) =>
  new URLSearchParams(params);

/** Menjalankan `fn` dan mengembalikan ApiError yang dilempar (gagal bila tidak ada). */
function apiErrorOf(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected an ApiError");
}

beforeEach(resetStaffStore);

describe("staffActions", () => {
  const caller = (over: Partial<MockCaller>): MockCaller => ({
    userUuid: "u",
    permissions: [PERMISSION.STAFF_MANAGE],
    managesEvent: true,
    relatedToEvent: true,
    ...over,
  });
  it("allows revoke only with staff.manage and the right to manage the event", () => {
    expect(staffActions(caller({})).revoke).toBe(true);
    expect(staffActions(caller({ managesEvent: false })).revoke).toBe(false);
    expect(
      staffActions(caller({ permissions: [PERMISSION.STAFF_INVITE] })).revoke,
    ).toBe(false);
  });
});

describe("assignment roles", () => {
  it("lists the six roles from the contract, ordered by sort_order", () => {
    const roles = listAssignmentRoles();
    expect(roles.map((r) => r.code)).toEqual([
      "EVENT_MANAGER",
      "COMPETITION_PIC",
      "JUDGE",
      "HEAD_JUDGE",
      "TIMER_OPERATOR",
      "MARSHAL",
    ]);
    expect(roles.find((r) => r.code === "EVENT_MANAGER")?.scope).toBe("EVENT");
  });
});

describe("seed data", () => {
  it("gives Paw Race 100m three PICs and one Judge, and the event one Event manager", () => {
    const rows = listEventStaff(admin, SURABAYA, query()).items;
    const team = rows.filter((r) => r.competition_uuid === null);
    expect(team.map((r) => r.assignment_role)).toEqual(["EVENT_MANAGER"]);
    const race = rows.filter((r) => r.competition_uuid === PAW_RACE_100M);
    expect(race.map((r) => r.assignment_role).sort()).toEqual([
      "COMPETITION_PIC",
      "COMPETITION_PIC",
      "COMPETITION_PIC",
      "JUDGE",
    ]);
  });
  it("sends name, email and actions with every assignment", () => {
    const [first] = listEventStaff(admin, SURABAYA, query()).items;
    expect(first.user_name).toBeTruthy();
    expect(first.user_email).toMatch(/@/);
    expect(first.actions).toEqual({ revoke: true });
  });
});

describe("GET staff lists", () => {
  it("lists one competition's staff", () => {
    const rows = listCompetitionStaff(admin, PAW_RACE_100M, query()).items;
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.competition_uuid === PAW_RACE_100M)).toBe(true);
  });
  it("hides revoked assignments", () => {
    const [first] = listCompetitionStaff(admin, PAW_RACE_100M, query()).items;
    revokeAssignmentRecord(admin, first.uuid);
    expect(
      listCompetitionStaff(admin, PAW_RACE_100M, query()).items,
    ).toHaveLength(3);
  });
  it("is 403 for someone unrelated to the event", () => {
    expect(
      apiErrorOf(() => listEventStaff(competitor, SURABAYA, query())).status,
    ).toBe(403);
  });
  it("lets an organization member of the event see and revoke its staff", () => {
    // Anggota organisasi Jakarta mengelola event Jakarta (tetapi bukan Surabaya).
    staffStore.assignments.push({
      uuid: "a-jakarta",
      event_uuid: JAKARTA,
      competition_uuid: null,
      user_uuid: competitor.uuid,
      assignment_role: "EVENT_MANAGER",
      status: "ACTIVE",
    });
    const rows = listEventStaff(organizer, JAKARTA, query()).items;
    expect(rows.find((r) => r.uuid === "a-jakarta")?.actions?.revoke).toBe(
      true,
    );
  });
});

describe("POST invitation", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    event_id: SURABAYA,
    email: "new.person@example.com",
    assignment_role: "EVENT_MANAGER",
    ...over,
  });

  it("stores a PENDING invitation for the event team and returns it with actions", () => {
    const invitation = createInvitationRecord(admin, body());
    expect(invitation).toMatchObject({
      event_uuid: SURABAYA,
      competition_uuid: null,
      email: "new.person@example.com",
      assignment_role: "EVENT_MANAGER",
      status: "PENDING",
      invitee_name: null,
      actions: { revoke: true },
    });
    expect(listInvitations(admin, query({ event_id: SURABAYA }))).toHaveLength(
      1,
    );
  });

  it("shows the PIC invited by the New event wizard as a pending Event manager of that event", () => {
    // Wizard: organizer mengundang email sebagai EVENT_MANAGER di event miliknya.
    createInvitationRecord(organizer, {
      event_id: JAKARTA,
      email: "new.pic@example.com",
      assignment_role: "EVENT_MANAGER",
    });
    const rows = listInvitations(organizer, query({ event_id: JAKARTA }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      competition_uuid: null,
      assignment_role: "EVENT_MANAGER",
      status: "PENDING",
    });
  });

  it("fills invitee_name when the email already has an account", () => {
    const invitation = createInvitationRecord(
      admin,
      body({ email: competitor.email }),
    );
    expect(invitation.invitee_name).toBe("Competitor Demo");
  });

  it("invites to a competition with a competition role", () => {
    const invitation = createInvitationRecord(
      admin,
      body({ competition_id: PAW_RACE_RELAY, assignment_role: "JUDGE" }),
    );
    expect(invitation.competition_uuid).toBe(PAW_RACE_RELAY);
  });

  it("is 403 for a caller who may not manage the event, before any data check", () => {
    const error = apiErrorOf(() =>
      createInvitationRecord(organizer, body({ email: "not-an-email" })),
    );
    expect(error.status).toBe(403);
  });

  it("is 422 per field for bad data", () => {
    const badEmail = apiErrorOf(() =>
      createInvitationRecord(admin, body({ email: "nope" })),
    );
    expect(badEmail.status).toBe(422);
    expect(badEmail.errors?.email).toBeDefined();

    const unknownRole = apiErrorOf(() =>
      createInvitationRecord(admin, body({ assignment_role: "KING" })),
    );
    expect(unknownRole.errors?.assignment_role).toBeDefined();
  });

  it("rejects a role that does not match the scope", () => {
    const eventWithJudge = apiErrorOf(() =>
      createInvitationRecord(admin, body({ assignment_role: "JUDGE" })),
    );
    expect(eventWithJudge.errors?.assignment_role?.[0]).toMatch(/event team/);
    const competitionWithManager = apiErrorOf(() =>
      createInvitationRecord(
        admin,
        body({
          competition_id: PAW_RACE_100M,
          assignment_role: "EVENT_MANAGER",
        }),
      ),
    );
    expect(competitionWithManager.errors?.assignment_role?.[0]).toMatch(
      /competition/,
    );
  });

  it("rejects an inactive role", () => {
    const judge = staffStore.roles.find((r) => r.code === "JUDGE");
    if (judge) judge.is_active = false;
    const error = apiErrorOf(() =>
      createInvitationRecord(
        admin,
        body({ competition_id: PAW_RACE_100M, assignment_role: "JUDGE" }),
      ),
    );
    expect(error.errors?.assignment_role).toBeDefined();
  });

  it("rejects a competition that belongs to another event", () => {
    const error = apiErrorOf(() =>
      createInvitationRecord(
        admin,
        body({
          event_id: JAKARTA,
          competition_id: PAW_RACE_100M,
          assignment_role: "JUDGE",
        }),
      ),
    );
    expect(error.errors?.competition_id).toBeDefined();
  });

  it("rejects the same pending invitation twice (email + role + target)", () => {
    createInvitationRecord(admin, body());
    const error = apiErrorOf(() => createInvitationRecord(admin, body()));
    expect(error.status).toBe(422);
    expect(error.errors?.email?.[0]).toMatch(/already pending/);
    // Email lain atau peran lain di target yang sama tetap boleh.
    expect(() =>
      createInvitationRecord(admin, body({ email: "other@example.com" })),
    ).not.toThrow();
  });

  it("rejects a user who already holds the same role at that target", () => {
    const sari = userBy("sari.wulandari@petpet.dev");
    const error = apiErrorOf(() =>
      createInvitationRecord(
        admin,
        body({
          email: sari.email,
          competition_id: PAW_RACE_100M,
          assignment_role: "COMPETITION_PIC",
        }),
      ),
    );
    expect(error.errors?.email?.[0]).toMatch(/already holds/);
    // Peran lain untuk orang yang sama boleh.
    expect(() =>
      createInvitationRecord(
        admin,
        body({
          email: sari.email,
          competition_id: PAW_RACE_100M,
          assignment_role: "MARSHAL",
        }),
      ),
    ).not.toThrow();
  });

  it("requires event_id", () => {
    const error = apiErrorOf(() =>
      createInvitationRecord(admin, { email: "a@b.co" }),
    );
    expect(error.errors?.event_id).toBeDefined();
  });
});

describe("GET invitations", () => {
  it("returns a flat array, PENDING and not expired only", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    const kept = createInvitationRecord(
      admin,
      {
        event_id: SURABAYA,
        email: "kept@example.com",
        assignment_role: "EVENT_MANAGER",
      },
      now,
    );
    const expired = createInvitationRecord(
      admin,
      {
        event_id: SURABAYA,
        email: "expired@example.com",
        assignment_role: "EVENT_MANAGER",
      },
      new Date("2026-09-01T00:00:00Z"),
    );
    const revoked = createInvitationRecord(
      admin,
      {
        event_id: SURABAYA,
        email: "revoked@example.com",
        assignment_role: "EVENT_MANAGER",
      },
      now,
    );
    revokeInvitationRecord(admin, revoked.uuid);

    const rows = listInvitations(admin, query({ event_id: SURABAYA }), now);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.map((r) => r.uuid)).toEqual([kept.uuid]);
    expect(rows.map((r) => r.uuid)).not.toContain(expired.uuid);
  });

  it("filters by competition_id", () => {
    createInvitationRecord(admin, {
      event_id: SURABAYA,
      competition_id: PAW_RACE_RELAY,
      email: "judge@example.com",
      assignment_role: "JUDGE",
    });
    createInvitationRecord(admin, {
      event_id: SURABAYA,
      email: "pic@example.com",
      assignment_role: "EVENT_MANAGER",
    });
    const rows = listInvitations(
      admin,
      query({ event_id: SURABAYA, competition_id: PAW_RACE_RELAY }),
    );
    expect(rows.map((r) => r.email)).toEqual(["judge@example.com"]);
  });

  it("is 403 for an event the caller does not manage, and empty without event_id", () => {
    createInvitationRecord(admin, {
      event_id: SURABAYA,
      email: "pic@example.com",
      assignment_role: "EVENT_MANAGER",
    });
    expect(
      apiErrorOf(() =>
        listInvitations(organizer, query({ event_id: SURABAYA })),
      ).status,
    ).toBe(403);
    expect(listInvitations(organizer, query())).toEqual([]);
    expect(listInvitations(admin, query())).toHaveLength(1);
  });
});

describe("revoke", () => {
  it("revokes a pending invitation and then refuses to do it again (422)", () => {
    const invitation = createInvitationRecord(admin, {
      event_id: SURABAYA,
      email: "pic@example.com",
      assignment_role: "EVENT_MANAGER",
    });
    expect(revokeInvitationRecord(admin, invitation.uuid)).toBeNull();
    expect(listInvitations(admin, query({ event_id: SURABAYA }))).toHaveLength(
      0,
    );
    expect(
      apiErrorOf(() => revokeInvitationRecord(admin, invitation.uuid)).status,
    ).toBe(422);
  });

  it("revokes an assignment so it disappears from the list", () => {
    const rows = listEventStaff(admin, SURABAYA, query()).items;
    const team = rows.find((r) => r.competition_uuid === null)!;
    expect(revokeAssignmentRecord(admin, team.uuid)).toBeNull();
    expect(
      listEventStaff(admin, SURABAYA, query()).items.some(
        (r) => r.uuid === team.uuid,
      ),
    ).toBe(false);
  });

  it("is 403 for a caller without the right (403 before 422)", () => {
    const row = listEventStaff(admin, SURABAYA, query()).items[0];
    expect(
      apiErrorOf(() => revokeAssignmentRecord(competitor, row.uuid)).status,
    ).toBe(403);
    revokeAssignmentRecord(admin, row.uuid);
    // Sudah dicabut, tetapi pemanggil tanpa hak tetap 403, bukan 422.
    expect(
      apiErrorOf(() => revokeAssignmentRecord(competitor, row.uuid)).status,
    ).toBe(403);
  });
});
