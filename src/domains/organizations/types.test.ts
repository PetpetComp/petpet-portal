import { describe, expect, it } from "vitest";
import {
  applicationFromApi,
  applicationStatusLabel,
  invitationFromApi,
  isOpenApplication,
  isWaitingApplication,
  memberFromApi,
  memberRoleLabel,
  organizationFromApi,
  organizationListParams,
  organizationPageFromApi,
  verificationFromApi,
  verificationTypeLabel,
} from "./types";

describe("organization mappers", () => {
  it("maps an organization and marks ACTIVE as verified", () => {
    const org = organizationFromApi({
      uuid: "o1",
      name: "KPSGI Jakarta",
      slug: "kpsgi-jakarta",
      description: null,
      email: null,
      phone: "0215500001",
      address: null,
      status: "ACTIVE",
      sponsor_uuid: null,
    });
    expect(org).toMatchObject({
      id: "o1",
      email: "",
      phone: "0215500001",
      isVerified: true,
    });
  });

  it("maps a page and builds list params without empty values", () => {
    const page = organizationPageFromApi({
      items: [],
      meta: { current_page: 2, per_page: 10, total: 25, last_page: 3 },
    });
    expect(page.meta).toEqual({ page: 2, perPage: 10, total: 25, lastPage: 3 });
    expect(organizationListParams({ q: "  ", page: 2, perPage: 10 })).toEqual({
      q: undefined,
      page: 2,
      per_page: 10,
    });
    expect(
      organizationListParams({ q: " east ", page: 1, perPage: 10 }).q,
    ).toBe("east");
  });

  it("maps members, tolerating a missing email", () => {
    const row = {
      uuid: "m1",
      user_uuid: "u1",
      user_name: "Salsa Putri",
      member_role: "OWNER",
      status: "ACTIVE",
    };
    expect(memberFromApi(row)).toEqual({
      id: "m1",
      userId: "u1",
      name: "Salsa Putri",
      email: null,
      role: "OWNER",
    });
    expect(memberFromApi({ ...row, user_email: "s@x.dev" }).email).toBe(
      "s@x.dev",
    );
  });

  it("maps an invitation and ignores the raw token", () => {
    const invite = invitationFromApi({
      uuid: "i1",
      organization_name: "X",
      email: "a@b.co",
      member_role: "STAFF",
      status: "PENDING",
      expires_at: "2026-10-17T00:00:00+00:00",
      token: "secret",
    });
    expect(invite).toEqual({
      id: "i1",
      email: "a@b.co",
      role: "STAFF",
      expiresAt: "2026-10-17T00:00:00+00:00",
    });
  });

  it("maps applications and verifications with optional backend gaps", () => {
    const app = applicationFromApi({
      uuid: "a1",
      proposed_organization_name: "Bekasi Pet Club",
      organization_type: null,
      description: null,
      contact_email: "h@b.id",
      contact_phone: null,
      address: null,
      status: "SUBMITTED",
      review_note: null,
      approved_organization_uuid: null,
    });
    expect(app.applicantName).toBeNull();
    expect(app.organizationType).toBe("");
    const v = verificationFromApi({
      uuid: "v1",
      organization_uuid: "o1",
      verification_type: "IDENTITY",
      status: "PENDING",
      rejection_reason: null,
    });
    expect(v.organizationName).toBeNull();
    expect(v.rejectionReason).toBe("");
  });
});

describe("labels and status helpers", () => {
  it("labels known codes and passes unknown ones through", () => {
    expect(memberRoleLabel("ADMIN")).toBe("Admin");
    expect(memberRoleLabel("VIEWER")).toBe("VIEWER");
    expect(applicationStatusLabel("SUBMITTED")).toBe("Waiting for review");
    expect(applicationStatusLabel("???")).toBe("???");
    expect(verificationTypeLabel("LEGAL_DOCUMENT")).toBe("Legal document");
  });
  it("tells waiting from open applications", () => {
    expect(isWaitingApplication({ status: "UNDER_REVIEW" })).toBe(true);
    expect(isWaitingApplication({ status: "DRAFT" })).toBe(false);
    expect(isOpenApplication({ status: "DRAFT" })).toBe(true);
    expect(isOpenApplication({ status: "REJECTED" })).toBe(false);
  });
});
