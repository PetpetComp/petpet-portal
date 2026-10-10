import { describe, expect, it } from "vitest";
import {
  FALLBACK_ASSIGNMENT_ROLES,
  invitationFromApi,
  memberFromApi,
  roleFromApi,
  type ApiStaffAssignment,
  type ApiStaffInvitation,
} from "./types";

const assignment: ApiStaffAssignment = {
  uuid: "a1",
  user_uuid: "u1",
  user_name: "Nadia Safitri",
  user_email: "nadia@example.com",
  competition_uuid: null,
  assignment_role: "EVENT_MANAGER",
  status: "ACTIVE",
  actions: { revoke: true },
};

describe("memberFromApi", () => {
  it("maps snake_case to the screen shape and reads actions.revoke", () => {
    expect(memberFromApi(assignment)).toEqual({
      id: "a1",
      userId: "u1",
      name: "Nadia Safitri",
      email: "nadia@example.com",
      competitionId: null,
      role: "EVENT_MANAGER",
      canRevoke: true,
    });
  });
  it("survives the current backend shape (no user_email, no actions): Remove stays hidden", () => {
    const old: ApiStaffAssignment = {
      uuid: "a1",
      user_uuid: "u1",
      user_name: "Nadia Safitri",
      competition_uuid: "c1",
      assignment_role: "JUDGE",
      status: "ACTIVE",
    };
    const member = memberFromApi(old);
    expect(member.email).toBeNull();
    expect(member.canRevoke).toBe(false);
  });
});

describe("invitationFromApi", () => {
  const row: ApiStaffInvitation = {
    uuid: "i1",
    event_uuid: "e1",
    competition_uuid: "c1",
    email: "x@example.com",
    assignment_role: "JUDGE",
    status: "PENDING",
    expires_at: "2026-10-17T00:00:00+00:00",
    invitee_name: "Alya Aditya",
    actions: { revoke: true },
  };
  it("maps fields and the optional extras", () => {
    expect(invitationFromApi(row)).toEqual({
      id: "i1",
      eventId: "e1",
      competitionId: "c1",
      email: "x@example.com",
      inviteeName: "Alya Aditya",
      role: "JUDGE",
      expiresAt: "2026-10-17T00:00:00+00:00",
      canRevoke: true,
    });
  });
  it("survives the current backend shape (no invitee_name, no actions)", () => {
    const old: ApiStaffInvitation = { ...row };
    delete old.invitee_name;
    delete old.actions;
    const invitation = invitationFromApi(old);
    expect(invitation.inviteeName).toBeNull();
    expect(invitation.canRevoke).toBe(false);
  });
});

describe("roleFromApi and the fallback list", () => {
  it("maps a role", () => {
    expect(roleFromApi(FALLBACK_ASSIGNMENT_ROLES[0])).toMatchObject({
      code: "EVENT_MANAGER",
      scope: "EVENT",
      isActive: true,
    });
  });
  it("has the six roles of the contract, only EVENT_MANAGER in the EVENT scope", () => {
    expect(FALLBACK_ASSIGNMENT_ROLES.map((r) => r.code).sort()).toEqual([
      "COMPETITION_PIC",
      "EVENT_MANAGER",
      "HEAD_JUDGE",
      "JUDGE",
      "MARSHAL",
      "TIMER_OPERATOR",
    ]);
    expect(
      FALLBACK_ASSIGNMENT_ROLES.filter((r) => r.scope === "EVENT").map(
        (r) => r.code,
      ),
    ).toEqual(["EVENT_MANAGER"]);
  });
});
