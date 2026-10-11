import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { mockAccess } from "./mock-access";
import {
  acceptInvitationRecord,
  approveApplicationRecord,
  approveVerificationRecord,
  cancelApplicationRecord,
  changeMemberRoleRecord,
  createOrganizationInvitationRecord,
  listApplicationRecords,
  listMemberRecords,
  listMyApplicationRecords,
  listOrganizationInvitationRecords,
  listOrganizationRecords,
  listVerificationQueueRecords,
  organizationStore,
  rejectApplicationRecord,
  rejectVerificationRecord,
  removeMemberRecord,
  resetOrganizationStore,
  revokeOrganizationInvitationRecord,
  submitApplicationRecord,
  submitVerificationRecord,
  updateOrganizationRecord,
} from "./mock-organizations";
import { store } from "./mock-store";
import type { MockOrganization, MockUser } from "./mock-types";

const userBy = (email: string) =>
  store.users.find((u) => u.email === email) as MockUser;
const admin = userBy("admin@petpet.dev");
/** OWNER Petpet Community. */
const owner = userBy("organizer@petpet.dev");
/** ADMIN Petpet Community, OWNER di organisasi lain. */
const bima = userBy("bima.saputra@petpet.dev");
/** STAFF Petpet Community. */
const dian = userBy("dian.kusuma@petpet.dev");
/** Bukan anggota organisasi mana pun. */
const outsider = userBy("sponsor@petpet.dev");
const PETPET = "org-petpet-community";
const EAST_JAVA = "org-east-java-pet-sport";

const query = (params: Record<string, string> = {}) =>
  new URLSearchParams(params);

function apiErrorOf(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected an ApiError");
}

const clone = <T>(value: T): T => structuredClone(value);
let savedOrganizations: MockOrganization[];

beforeEach(() => {
  savedOrganizations = clone(store.organizations);
  resetOrganizationStore();
});
afterEach(() => {
  store.organizations = savedOrganizations;
});

describe("organizations list and detail", () => {
  it("lists ten organizations by name with backend meta and default 15 per page", () => {
    const data = listOrganizationRecords(query());
    expect(data.meta).toEqual({
      current_page: 1,
      per_page: 15,
      total: 10,
      last_page: 1,
    });
    const names = data.items.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(data.items[0]).toMatchObject({
      status: "ACTIVE",
      sponsor_uuid: null,
    });
  });
  it("pages and searches by name", () => {
    expect(
      listOrganizationRecords(query({ per_page: "4", page: "3" })).items,
    ).toHaveLength(2);
    const found = listOrganizationRecords(query({ q: "kpsgi" }));
    expect(found.meta.total).toBe(3);
  });
});

describe("update organization", () => {
  it("lets an owner update, keeping the slug", () => {
    const before = listOrganizationRecords(query({ q: "petpet" })).items[0];
    const updated = updateOrganizationRecord(owner, PETPET, {
      name: "Petpet Community ID",
      phone: "",
    });
    expect(updated.name).toBe("Petpet Community ID");
    expect(updated.phone).toBeNull();
    expect(updated.slug).toBe(before.slug);
  });
  it("rejects staff and outsiders with 403, unknown org with 404", () => {
    expect(
      apiErrorOf(() => updateOrganizationRecord(dian, PETPET, { name: "X" }))
        .status,
    ).toBe(403);
    expect(
      apiErrorOf(() =>
        updateOrganizationRecord(outsider, PETPET, { name: "X" }),
      ).status,
    ).toBe(403);
    expect(
      apiErrorOf(() => updateOrganizationRecord(owner, "nope", { name: "X" }))
        .status,
    ).toBe(404);
  });
  it("lets a super admin update any organization", () => {
    expect(
      updateOrganizationRecord(admin, EAST_JAVA, { name: "EJ" }).name,
    ).toBe("EJ");
  });
  it("validates before checking the caller", () => {
    const error = apiErrorOf(() =>
      updateOrganizationRecord(outsider, PETPET, { email: "bad", name: "" }),
    );
    expect(error.status).toBe(422);
    expect(error.errors).toHaveProperty("email");
    expect(error.errors).toHaveProperty("name");
  });
});

describe("members", () => {
  it("lists members with email for members and super admin, 403 for outsiders", () => {
    const rows = listMemberRecords(dian, PETPET);
    expect(rows.map((r) => r.member_role)).toEqual(["OWNER", "ADMIN", "STAFF"]);
    expect(rows[0]).toMatchObject({
      user_email: "organizer@petpet.dev",
      status: "ACTIVE",
    });
    expect(listMemberRecords(admin, PETPET)).toHaveLength(3);
    expect(apiErrorOf(() => listMemberRecords(outsider, PETPET)).status).toBe(
      403,
    );
  });

  it("lets only an owner change roles", () => {
    const changed = changeMemberRoleRecord(owner, PETPET, dian.uuid, {
      member_role: "ADMIN",
    });
    expect(changed.member_role).toBe("ADMIN");
    expect(
      mockAccess(dian).organizations.find((o) => o.uuid === PETPET)
        ?.member_role,
    ).toBe("ADMIN");
    expect(
      apiErrorOf(() =>
        changeMemberRoleRecord(bima, PETPET, dian.uuid, {
          member_role: "STAFF",
        }),
      ).status,
    ).toBe(403);
  });
  it("validates the role and the member", () => {
    expect(
      apiErrorOf(() =>
        changeMemberRoleRecord(owner, PETPET, dian.uuid, {
          member_role: "BOSS",
        }),
      ).status,
    ).toBe(422);
    const error = apiErrorOf(() =>
      changeMemberRoleRecord(owner, PETPET, "ghost", { member_role: "STAFF" }),
    );
    expect(error).toMatchObject({ status: 404, message: "Member not found." });
  });
  it("refuses to demote the last owner", () => {
    const error = apiErrorOf(() =>
      changeMemberRoleRecord(owner, PETPET, owner.uuid, {
        member_role: "ADMIN",
      }),
    );
    expect(error.status).toBe(422);
    expect(error.message).toMatch(/last owner/);
  });

  it("removes a member and drops their organizer access when it was their only organization", () => {
    removeMemberRecord(owner, PETPET, dian.uuid);
    expect(listMemberRecords(owner, PETPET)).toHaveLength(2);
  });
  it("stops an admin from removing an owner and anyone from removing the last owner", () => {
    const adminVsOwner = apiErrorOf(() =>
      removeMemberRecord(bima, PETPET, owner.uuid),
    );
    expect(adminVsOwner).toMatchObject({
      status: 403,
      message: "An admin cannot remove an owner.",
    });
    const lastOwner = apiErrorOf(() =>
      removeMemberRecord(owner, PETPET, owner.uuid),
    );
    expect(lastOwner.status).toBe(422);
    expect(
      apiErrorOf(() => removeMemberRecord(dian, PETPET, bima.uuid)).status,
    ).toBe(403);
  });
});

describe("organization invitations", () => {
  it("creates an invitation with a token, 7 days, and lists it as pending", () => {
    const created = createOrganizationInvitationRecord(owner, PETPET, {
      email: "new.person@example.com",
      member_role: "STAFF",
    });
    expect(created).toMatchObject({
      organization_name: "Petpet Community",
      status: "PENDING",
      member_role: "STAFF",
    });
    expect(created.token).toBeTruthy();
    const days = (Date.parse(created.expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    const listed = listOrganizationInvitationRecords(owner, PETPET);
    expect(listed[0].uuid).toBe(created.uuid);
    expect(listed[0]).not.toHaveProperty("token");
  });
  it("accepts only ADMIN or STAFF and a valid email, 422 before 403", () => {
    const badRole = apiErrorOf(() =>
      createOrganizationInvitationRecord(outsider, PETPET, {
        email: "a@b.co",
        member_role: "OWNER",
      }),
    );
    expect(badRole.status).toBe(422);
    expect(badRole.errors).toHaveProperty("member_role");
    expect(
      apiErrorOf(() =>
        createOrganizationInvitationRecord(dian, PETPET, {
          email: "a@b.co",
          member_role: "STAFF",
        }),
      ).status,
    ).toBe(403);
  });
  it("rejects existing members and duplicate pending invitations (mock-only rule)", () => {
    const member = apiErrorOf(() =>
      createOrganizationInvitationRecord(owner, PETPET, {
        email: dian.email,
        member_role: "STAFF",
      }),
    );
    expect(member.errors).toHaveProperty("email");
    const duplicate = apiErrorOf(() =>
      createOrganizationInvitationRecord(owner, PETPET, {
        email: "FARAH.INVITED@example.com",
        member_role: "STAFF",
      }),
    );
    expect(duplicate.errors).toHaveProperty("email");
  });
  it("hides invitations from staff and revokes only within the organization", () => {
    expect(
      apiErrorOf(() => listOrganizationInvitationRecords(dian, PETPET)).status,
    ).toBe(403);
    expect(
      apiErrorOf(() =>
        revokeOrganizationInvitationRecord(owner, PETPET, "oinv-east-java-1"),
      ).status,
    ).toBe(404);
    revokeOrganizationInvitationRecord(owner, PETPET, "oinv-petpet-1");
    expect(listOrganizationInvitationRecords(owner, PETPET)).toHaveLength(0);
  });
  it("lets the invited person accept, becoming a member", () => {
    const created = createOrganizationInvitationRecord(owner, PETPET, {
      email: outsider.email,
      member_role: "ADMIN",
    });
    expect(
      apiErrorOf(() => acceptInvitationRecord(dian, created.token as string))
        .status,
    ).toBe(403);
    acceptInvitationRecord(outsider, created.token as string);
    expect(
      listMemberRecords(owner, PETPET).some(
        (m) => m.user_uuid === outsider.uuid,
      ),
    ).toBe(true);
    expect(
      apiErrorOf(() =>
        acceptInvitationRecord(outsider, created.token as string),
      ).status,
    ).toBe(422);
  });
  it("answers 410 for an expired invitation", () => {
    const expired = organizationStore.invitations.find(
      (i) => i.uuid === "oinv-east-java-2",
    );
    expect(
      apiErrorOf(() => acceptInvitationRecord(outsider, expired!.token)).status,
    ).toBe(410);
  });
});

describe("organizer applications", () => {
  const body = {
    proposed_organization_name: "Depok Glider Club",
    contact_email: "d@g.id",
  };

  it("lets anyone apply once, then blocks a second open application", () => {
    const first = submitApplicationRecord(outsider, body);
    expect(first).toMatchObject({
      status: "SUBMITTED",
      applicant_email: outsider.email,
    });
    const second = apiErrorOf(() => submitApplicationRecord(outsider, body));
    expect(second).toMatchObject({
      status: 422,
      message: "You already have an application in progress.",
    });
    expect(listMyApplicationRecords(outsider)).toHaveLength(1);
  });
  it("allows applying again after a rejection", () => {
    const competitor = userBy("competitor@petpet.dev");
    expect(listMyApplicationRecords(competitor)[0].status).toBe("REJECTED");
    expect(submitApplicationRecord(competitor, body).status).toBe("SUBMITTED");
    expect(
      listMyApplicationRecords(competitor)[0].proposed_organization_name,
    ).toBe("Depok Glider Club");
  });
  it("validates required fields and limits", () => {
    const error = apiErrorOf(() =>
      submitApplicationRecord(outsider, {
        contact_email: "bad",
        contact_phone: "1".repeat(31),
      }),
    );
    expect(Object.keys(error.errors ?? {}).sort()).toEqual([
      "contact_email",
      "contact_phone",
      "proposed_organization_name",
    ]);
  });
  it("lists the review queue only for organization.verify holders", () => {
    expect(
      apiErrorOf(() => listApplicationRecords(owner, query())).status,
    ).toBe(403);
    const waiting = listApplicationRecords(
      admin,
      query({ status: "SUBMITTED" }),
    );
    expect(waiting.items.map((a) => a.uuid)).toEqual(["app-bekasi-pet-club"]);
    expect(waiting.items[0].applicant_name).toBe("Sari Wulandari");
    expect(listApplicationRecords(admin, query()).meta.total).toBe(3);
  });
  it("approves into an ACTIVE organization with the applicant as OWNER", () => {
    const sari = userBy("sari.wulandari@petpet.dev");
    expect(mockAccess(sari).roles.map((r) => r.code)).toEqual(["USER"]);
    const approved = approveApplicationRecord(admin, "app-bekasi-pet-club");
    expect(approved.status).toBe("APPROVED");
    const organization = listOrganizationRecords(query({ q: "bekasi" }))
      .items[0];
    expect(organization).toMatchObject({
      uuid: approved.approved_organization_uuid,
      slug: "bekasi-pet-club",
    });
    expect(listMemberRecords(admin, organization.uuid)[0]).toMatchObject({
      user_uuid: sari.uuid,
      member_role: "OWNER",
    });
    expect(mockAccess(sari).roles.map((r) => r.code)).toContain("ORGANIZER");
    expect(
      apiErrorOf(() => approveApplicationRecord(admin, "app-bekasi-pet-club"))
        .status,
    ).toBe(422);
  });
  it("makes the slug unique when the name is taken", () => {
    organizationStore.applications[0].proposed_organization_name =
      "KPSGI Jakarta";
    const approved = approveApplicationRecord(admin, "app-bekasi-pet-club");
    const created = listOrganizationRecords(
      query({ per_page: "50" }),
    ).items.find((o) => o.uuid === approved.approved_organization_uuid);
    expect(created?.slug).toBe("kpsgi-jakarta-2");
  });
  it("checks permission before data on approve", () => {
    expect(
      apiErrorOf(() => approveApplicationRecord(owner, "app-bekasi-pet-club"))
        .status,
    ).toBe(403);
    expect(
      apiErrorOf(() => approveApplicationRecord(admin, "ghost")).status,
    ).toBe(404);
  });
  it("rejects with a required note, validating first", () => {
    expect(
      apiErrorOf(() =>
        rejectApplicationRecord(owner, "app-bekasi-pet-club", {}),
      ).status,
    ).toBe(422);
    expect(
      apiErrorOf(() =>
        rejectApplicationRecord(owner, "app-bekasi-pet-club", {
          review_note: "no",
        }),
      ).status,
    ).toBe(403);
    const rejected = rejectApplicationRecord(admin, "app-solo-glider", {
      review_note: " Not enough info ",
    });
    expect(rejected).toMatchObject({
      status: "REJECTED",
      review_note: "Not enough info",
    });
    expect(
      apiErrorOf(() =>
        rejectApplicationRecord(admin, "app-solo-glider", {
          review_note: "again",
        }),
      ).message,
    ).toBe("This application has already been reviewed.");
  });
  it("cancels only your own SUBMITTED application", () => {
    const sari = userBy("sari.wulandari@petpet.dev");
    expect(
      apiErrorOf(() => cancelApplicationRecord(outsider, "app-bekasi-pet-club"))
        .status,
    ).toBe(403);
    cancelApplicationRecord(sari, "app-bekasi-pet-club");
    expect(listMyApplicationRecords(sari)[0].status).toBe("CANCELLED");
    const rangga = userBy("rangga.putra@petpet.dev");
    expect(
      apiErrorOf(() => cancelApplicationRecord(rangga, "app-solo-glider"))
        .status,
    ).toBe(422);
  });
});

describe("organization verifications", () => {
  it("lets only an owner submit, one per type, resubmitting after rejection", () => {
    expect(
      apiErrorOf(() =>
        submitVerificationRecord(bima, PETPET, {
          verification_type: "BANK_ACCOUNT",
        }),
      ).status,
    ).toBe(403);
    expect(
      apiErrorOf(() =>
        submitVerificationRecord(owner, PETPET, { verification_type: "NOPE" }),
      ).status,
    ).toBe(422);
    const created = submitVerificationRecord(owner, PETPET, {
      verification_type: "BANK_ACCOUNT",
    });
    expect(created).toMatchObject({
      status: "PENDING",
      organization_name: "Petpet Community",
    });
    expect(
      apiErrorOf(() =>
        submitVerificationRecord(owner, PETPET, {
          verification_type: "BANK_ACCOUNT",
        }),
      ).message,
    ).toBe("A verification of this type has already been submitted.");
    const again = submitVerificationRecord(owner, PETPET, {
      verification_type: "LEGAL_DOCUMENT",
    });
    expect(again).toMatchObject({ status: "PENDING", rejection_reason: null });
  });
  it("runs the review queue for organization.verify holders", () => {
    expect(
      apiErrorOf(() => listVerificationQueueRecords(owner, query())).status,
    ).toBe(403);
    const pending = listVerificationQueueRecords(
      admin,
      query({ status: "PENDING" }),
    );
    expect(pending.items.map((v) => v.uuid)).toEqual([
      "ver-east-java-identity",
    ]);
    approveVerificationRecord(admin, "ver-east-java-identity");
    expect(
      listVerificationQueueRecords(admin, query({ status: "PENDING" })).items,
    ).toHaveLength(0);
    expect(
      apiErrorOf(() =>
        approveVerificationRecord(admin, "ver-east-java-identity"),
      ).status,
    ).toBe(422);
  });
  it("requires a rejection reason", () => {
    expect(
      apiErrorOf(() =>
        rejectVerificationRecord(admin, "ver-east-java-identity", {}),
      ).status,
    ).toBe(422);
    const rejected = rejectVerificationRecord(admin, "ver-east-java-identity", {
      rejection_reason: "Blurry",
    });
    expect(rejected).toMatchObject({
      status: "REJECTED",
      rejection_reason: "Blurry",
    });
  });
});
