import { describe, expect, it } from "vitest";
import type { CompetitionType } from "@/domains/competitions/types";
import {
  FALLBACK_ASSIGNMENT_ROLES,
  roleFromApi,
  type PendingInvitation,
  type StaffMember,
} from "@/domains/staff/types";
import { competitionFixture } from "@/test/fixtures";
import {
  buildCommitteeGroups,
  defaultOpenKeys,
  groupCountLabel,
  kindChipLabel,
  roleChipClass,
} from "./committee-groups";

const roles = FALLBACK_ASSIGNMENT_ROLES.map(roleFromApi);
const types: CompetitionType[] = [
  { id: "t-race", code: "RACE", name: "Race", resultMode: "POSITION" },
  {
    id: "t-beauty",
    code: "BEAUTY",
    name: "Beauty",
    resultMode: "JUDGED_SCORE",
  },
];

const competitions = [
  competitionFixture({ id: "c1", name: "Paw Sprint 100M", typeId: "t-race" }),
  competitionFixture({ id: "c2", name: "Best Costume", typeId: "t-beauty" }),
  competitionFixture({ id: "c3", name: "Paw Sprint 50M", typeId: "t-race" }),
];

const member = (over: Partial<StaffMember>): StaffMember => ({
  id: "m",
  userId: "u",
  name: "Name",
  email: null,
  competitionId: null,
  role: "COMPETITION_PIC",
  canRevoke: true,
  ...over,
});

const invitation = (over: Partial<PendingInvitation>): PendingInvitation => ({
  id: "i",
  eventId: "e1",
  competitionId: null,
  email: "x@example.com",
  inviteeName: null,
  role: "EVENT_MANAGER",
  expiresAt: null,
  canRevoke: true,
  ...over,
});

const build = (members: StaffMember[], invitations: PendingInvitation[] = []) =>
  buildCommitteeGroups({ competitions, types, roles, members, invitations });

describe("buildCommitteeGroups", () => {
  it("puts Event team first, then one group per competition in the given order", () => {
    const groups = build([]);
    expect(groups.map((g) => g.title)).toEqual([
      "Event team",
      "Paw Sprint 100M",
      "Best Costume",
      "Paw Sprint 50M",
    ]);
    expect(groups[0]).toMatchObject({
      key: "event",
      competitionId: null,
      kind: null,
    });
    expect(groups[1]).toMatchObject({
      key: "c1",
      competitionId: "c1",
      kind: "race",
    });
    expect(groups[2].kind).toBe("contest");
  });

  it("files members and invitations by competitionId (null = event team)", () => {
    const groups = build(
      [
        member({ id: "m1", competitionId: null, role: "EVENT_MANAGER" }),
        member({ id: "m2", competitionId: "c1" }),
        member({ id: "m3", competitionId: "c3" }),
      ],
      [
        invitation({ id: "i1", competitionId: null }),
        invitation({ id: "i2", competitionId: "c1", role: "JUDGE" }),
      ],
    );
    expect(groups[0].members.map((m) => m.id)).toEqual(["m1"]);
    expect(groups[0].invitations.map((i) => i.id)).toEqual(["i1"]);
    expect(groups[1].members.map((m) => m.id)).toEqual(["m2"]);
    expect(groups[1].invitations.map((i) => i.id)).toEqual(["i2"]);
    expect(groups[3].members.map((m) => m.id)).toEqual(["m3"]);
    expect(groups[2].members).toEqual([]);
  });

  it("orders members by role order, then name, and shows unknown roles last", () => {
    const groups = build([
      member({ id: "a", name: "Zed", role: "JUDGE", competitionId: "c1" }),
      member({ id: "b", name: "Amy", role: "JUDGE", competitionId: "c1" }),
      member({
        id: "c",
        name: "Bob",
        role: "COMPETITION_PIC",
        competitionId: "c1",
      }),
      member({
        id: "d",
        name: "Cat",
        role: "PHOTOGRAPHER",
        competitionId: "c1",
      }),
    ]);
    expect(groups[1].members.map((m) => m.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("skips assignments of a competition that is not in the list", () => {
    const groups = build([member({ id: "ghost", competitionId: "gone" })]);
    expect(groups.flatMap((g) => g.members)).toEqual([]);
  });

  it("does not change the arrays it receives", () => {
    const members = [
      member({ id: "a", name: "Zed", competitionId: "c1" }),
      member({ id: "b", name: "Amy", competitionId: "c1" }),
    ];
    build(members);
    expect(members.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("defaultOpenKeys", () => {
  it("opens the event team and the first competition that has people", () => {
    const groups = build([member({ competitionId: "c3" })]);
    expect(defaultOpenKeys(groups)).toEqual(["event", "c3"]);
  });
  it("counts a pending invitation as people for this rule", () => {
    const groups = build(
      [],
      [invitation({ competitionId: "c2", role: "JUDGE" })],
    );
    expect(defaultOpenKeys(groups)).toEqual(["event", "c2"]);
  });
  it("opens only the event team when no competition has anyone", () => {
    expect(defaultOpenKeys(build([]))).toEqual(["event"]);
  });
});

describe("groupCountLabel", () => {
  it("pluralizes and mentions pending invitations separately", () => {
    const [team, c1] = build(
      [member({ competitionId: "c1" }), member({ competitionId: "c1" })],
      [invitation({ competitionId: null })],
    );
    expect(groupCountLabel(c1)).toBe("2 people");
    expect(groupCountLabel(team)).toBe("0 people · 1 pending");
    const single = build([member({ competitionId: "c1" })])[1];
    expect(groupCountLabel(single)).toBe("1 person");
  });
});

describe("chip helpers", () => {
  it("colors Judge roles differently from the other roles", () => {
    expect(roleChipClass("JUDGE")).toBe(roleChipClass("HEAD_JUDGE"));
    expect(roleChipClass("JUDGE")).not.toBe(roleChipClass("COMPETITION_PIC"));
    expect(roleChipClass("SOMETHING_NEW")).toBe(roleChipClass("MARSHAL"));
  });
  it("capitalizes the kind label", () => {
    expect(kindChipLabel("time trial")).toBe("Time trial");
  });
});
