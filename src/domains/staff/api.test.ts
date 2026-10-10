import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import {
  countEventCommittee,
  getAssignmentRoles,
  getEventInvitations,
  getEventStaff,
} from "./api";
import { FALLBACK_ASSIGNMENT_ROLES } from "./types";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

/** Membuat respons API dengan `data` apa adanya. */
const respond = (data: unknown) => ({ success: true, message: "OK", data });

/** Memetakan path ke respons; path lain gagal. Dipakai menggantikan `apiClient.get`. */
function routeGet(routes: Record<string, unknown | Error>) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    const path = url.split("?")[0];
    const result = routes[path];
    if (result instanceof Error) throw result;
    if (result === undefined) throw new Error(`Unexpected GET ${url}`);
    return respond(result);
  });
}

beforeEach(() => vi.resetAllMocks());

describe("getAssignmentRoles", () => {
  it("maps the roles the API sends", async () => {
    routeGet({
      "/master/assignment-roles": [
        {
          code: "JUDGE",
          label: "Judge",
          scope: "COMPETITION",
          description: null,
          sort_order: 5,
          is_active: true,
        },
      ],
    });
    expect(await getAssignmentRoles()).toEqual([
      {
        code: "JUDGE",
        label: "Judge",
        scope: "COMPETITION",
        description: "",
        sortOrder: 5,
        isActive: true,
      },
    ]);
  });
  it("falls back to the built-in list when the endpoint fails (not in the real backend yet)", async () => {
    routeGet({ "/master/assignment-roles": new Error("404") });
    const roles = await getAssignmentRoles();
    expect(roles.map((r) => r.code)).toEqual(
      FALLBACK_ASSIGNMENT_ROLES.map((r) => r.code),
    );
  });
});

describe("list readers accept both response shapes", () => {
  const row = {
    uuid: "a1",
    user_uuid: "u1",
    user_name: "Nadia",
    competition_uuid: null,
    assignment_role: "EVENT_MANAGER",
    status: "ACTIVE",
  };
  it("reads a flat array (real backend) and { items, meta } (contract), only ACTIVE", async () => {
    routeGet({
      "/events/e1/staff": [row, { ...row, uuid: "a2", status: "REVOKED" }],
    });
    expect((await getEventStaff("e1")).map((m) => m.id)).toEqual(["a1"]);
    routeGet({
      "/events/e1/staff": { items: [row], meta: { last_page: 1, total: 1 } },
    });
    expect((await getEventStaff("e1")).map((m) => m.id)).toEqual(["a1"]);
  });
  it("keeps only PENDING invitations", async () => {
    const invitation = {
      uuid: "i1",
      event_uuid: "e1",
      competition_uuid: null,
      email: "a@b.co",
      assignment_role: "EVENT_MANAGER",
      expires_at: null,
    };
    routeGet({
      "/staff-invitations": [
        { ...invitation, status: "PENDING" },
        { ...invitation, uuid: "i2", status: "ACCEPTED" },
      ],
    });
    expect((await getEventInvitations("e1")).map((i) => i.id)).toEqual(["i1"]);
  });
});

describe("countEventCommittee (checklist 'Committee invited')", () => {
  const assignments = (total: number) => ({
    items: [],
    meta: { total, last_page: 1 },
  });
  const pending = [
    {
      uuid: "i1",
      event_uuid: "e1",
      competition_uuid: null,
      email: "a@b.co",
      assignment_role: "EVENT_MANAGER",
      status: "PENDING",
      expires_at: null,
    },
  ];
  it("counts assignments", async () => {
    routeGet({ "/events/e1/staff": assignments(3) });
    expect(await countEventCommittee("e1")).toBe(3);
  });
  it("counts a PENDING invitation when nobody is assigned yet", async () => {
    routeGet({
      "/events/e1/staff": assignments(0),
      "/staff-invitations": pending,
    });
    expect(await countEventCommittee("e1")).toBe(1);
  });
  it("is 0 when nobody is assigned and invitations cannot be read (403)", async () => {
    routeGet({
      "/events/e1/staff": assignments(0),
      "/staff-invitations": new Error("403"),
    });
    expect(await countEventCommittee("e1")).toBe(0);
  });
});
