import { describe, expect, it } from "vitest";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  ANONYMOUS,
  activePeriod,
  competitionActions,
  entryActions,
  entrySummary,
  registrationClosedReason,
  type MockCaller,
} from "./mock-rules";
import type { MockEntry, MockRegistrationPeriod } from "./mock-types";

const staff: MockCaller = {
  userUuid: "staff",
  permissions: [
    PERMISSION.REGISTRATION_APPROVE,
    PERMISSION.REGISTRATION_REJECT,
    PERMISSION.COMPETITION_UPDATE,
    PERMISSION.COMPETITION_DELETE,
  ],
  managesEvent: true,
  relatedToEvent: true,
};
const outsider: MockCaller = { ...staff, managesEvent: false };
const owner: MockCaller = {
  userUuid: "owner",
  permissions: [PERMISSION.REGISTRATION_VIEW],
  managesEvent: false,
  relatedToEvent: false,
};

type EntryState = Pick<
  MockEntry,
  | "owner_uuid"
  | "eligibility_status"
  | "payment_status"
  | "checkin_status"
  | "status"
>;
/** Default sudah lunas, supaya tes lama tidak terpengaruh aturan gerbang bayar. */
const entry = (over: Partial<EntryState> = {}): EntryState => ({
  owner_uuid: "owner",
  eligibility_status: "PENDING",
  payment_status: "PAID",
  checkin_status: "NOT_CHECKED_IN",
  status: "REGISTERED",
  ...over,
});
const allowed = (actions: Record<string, boolean>) =>
  Object.keys(actions).filter((k) => actions[k]);

describe("entryActions (EntryActions)", () => {
  it("lets staff review a pending entry", () => {
    expect(allowed(entryActions(entry(), "SCHEDULED", staff))).toEqual([
      "approve",
      "reject",
    ]);
  });
  it("check-in needs an approved entry and a scheduled or ongoing competition", () => {
    const approved = entry({ eligibility_status: "APPROVED" });
    expect(entryActions(approved, "ONGOING", staff).check_in).toBe(true);
    expect(entryActions(approved, "SCHEDULED", staff).check_in).toBe(true);
    expect(entryActions(approved, "DRAFT", staff).check_in).toBe(false);
    expect(entryActions(entry(), "ONGOING", staff).check_in).toBe(false);
  });
  it("check-in is locked until the entry is paid (decision 10 Oct 2026)", () => {
    const unpaid = entry({
      eligibility_status: "APPROVED",
      payment_status: "UNPAID",
    });
    expect(entryActions(unpaid, "ONGOING", staff).check_in).toBe(false);
    expect(entryActions(unpaid, "ONGOING", staff).mark_paid).toBe(true);
    const paid = { ...unpaid, payment_status: "PAID" as const };
    expect(entryActions(paid, "ONGOING", staff).check_in).toBe(true);
    expect(entryActions(paid, "ONGOING", staff).mark_paid).toBe(false);
  });
  it("mark_paid is for staff, and not for rejected entries", () => {
    const unpaid = entry({ payment_status: "UNPAID" });
    expect(entryActions(unpaid, "SCHEDULED", staff).mark_paid).toBe(true);
    expect(entryActions(unpaid, "SCHEDULED", owner).mark_paid).toBe(false);
    expect(
      entryActions(
        entry({ payment_status: "UNPAID", eligibility_status: "REJECTED" }),
        "SCHEDULED",
        staff,
      ).mark_paid,
    ).toBe(false);
  });
  it("undo only before the competition starts", () => {
    const done = entry({
      eligibility_status: "APPROVED",
      checkin_status: "CHECKED_IN",
    });
    expect(entryActions(done, "SCHEDULED", staff).undo_check_in).toBe(true);
    expect(entryActions(done, "ONGOING", staff).undo_check_in).toBe(false);
    expect(entryActions(done, "ONGOING", staff).check_in).toBe(false);
  });
  it("withdraw is the owner's, until check-in", () => {
    expect(entryActions(entry(), "SCHEDULED", owner).withdraw).toBe(true);
    expect(entryActions(entry(), "SCHEDULED", staff).withdraw).toBe(false);
    expect(
      entryActions(entry({ checkin_status: "CHECKED_IN" }), "SCHEDULED", owner)
        .withdraw,
    ).toBe(false);
  });
  it("nothing for withdrawn entries, finished competitions, outsiders or anonymous", () => {
    const none = {
      approve: false,
      reject: false,
      mark_paid: false,
      check_in: false,
      undo_check_in: false,
      withdraw: false,
    };
    expect(
      entryActions(entry({ status: "WITHDRAWN" }), "SCHEDULED", staff),
    ).toEqual(none);
    expect(entryActions(entry(), "COMPLETED", staff)).toEqual(none);
    expect(entryActions(entry(), "CANCELLED", owner)).toEqual(none);
    expect(entryActions(entry(), "SCHEDULED", outsider)).toEqual(none);
    expect(entryActions(entry(), "SCHEDULED", ANONYMOUS)).toEqual(none);
  });
});

describe("competitionActions (CompetitionActions)", () => {
  const open = { registration_closed_at: null };
  it("follows the lifecycle", () => {
    expect(
      allowed(
        competitionActions({ ...open, status: "DRAFT" }, "PUBLISHED", staff),
      ),
    ).toEqual(["publish", "cancel"]);
    expect(
      allowed(
        competitionActions(
          { ...open, status: "SCHEDULED" },
          "PUBLISHED",
          staff,
        ),
      ),
    ).toEqual(["start", "close_registration", "cancel"]);
    expect(
      allowed(
        competitionActions({ ...open, status: "ONGOING" }, "PUBLISHED", staff),
      ),
    ).toEqual(["complete", "cancel"]);
    expect(
      allowed(
        competitionActions(
          { ...open, status: "COMPLETED" },
          "PUBLISHED",
          staff,
        ),
      ),
    ).toEqual([]);
  });
  it("no publish in a cancelled event, no second close", () => {
    expect(
      competitionActions({ ...open, status: "DRAFT" }, "CANCELLED", staff)
        .publish,
    ).toBe(false);
    expect(
      competitionActions(
        { status: "SCHEDULED", registration_closed_at: "2026-10-01" },
        "PUBLISHED",
        staff,
      ).close_registration,
    ).toBe(false);
  });
  it("needs the permission and the event", () => {
    const updateOnly = {
      ...staff,
      permissions: [PERMISSION.COMPETITION_UPDATE],
    };
    expect(
      competitionActions(
        { ...open, status: "SCHEDULED" },
        "PUBLISHED",
        updateOnly,
      ).cancel,
    ).toBe(false);
    expect(
      allowed(
        competitionActions(
          { ...open, status: "SCHEDULED" },
          "PUBLISHED",
          outsider,
        ),
      ),
    ).toEqual([]);
  });
});

describe("RegistrationWindow", () => {
  const period = (
    uuid: string,
    start: string,
    end: string,
    status: "ACTIVE" | "CLOSED" = "ACTIVE",
  ): MockRegistrationPeriod => ({
    uuid,
    competition_uuid: "c",
    period_type: "ONLINE",
    price: 50000,
    quota: null,
    registration_start_at: start,
    registration_end_at: end,
    status,
  });
  const now = new Date("2026-10-10T03:00:00Z");
  const periods = [
    period("closed", "2026-10-01T00:00:00Z", "2026-10-30T00:00:00Z", "CLOSED"),
    period("past", "2026-09-01T00:00:00Z", "2026-09-30T00:00:00Z"),
    period("now", "2026-10-01T00:00:00Z", "2026-10-30T00:00:00Z"),
  ];
  const scheduled = {
    status: "SCHEDULED" as const,
    registration_closed_at: null,
    capacity: 10,
  };

  it("active period: the first active one whose window contains now", () => {
    expect(activePeriod(periods, now)?.uuid).toBe("now");
    expect(activePeriod(periods.slice(0, 2), now)).toBeNull();
  });
  it("is open when every rule passes, also without periods", () => {
    expect(
      registrationClosedReason(scheduled, "Published", periods, 3, now),
    ).toBeNull();
    expect(
      registrationClosedReason(scheduled, "PUBLISHED", [], 3, now),
    ).toBeNull();
  });
  it("reports the first failing rule", () => {
    expect(registrationClosedReason(scheduled, "Draft", periods, 3, now)).toBe(
      "EVENT_NOT_PUBLISHED",
    );
    expect(
      registrationClosedReason(
        { ...scheduled, status: "ONGOING" },
        "PUBLISHED",
        periods,
        3,
        now,
      ),
    ).toBe("NOT_SCHEDULED");
    expect(
      registrationClosedReason(
        { ...scheduled, registration_closed_at: "2026-10-09T00:00:00Z" },
        "PUBLISHED",
        periods,
        3,
        now,
      ),
    ).toBe("CLOSED_BY_ORGANIZER");
    expect(
      registrationClosedReason(
        scheduled,
        "PUBLISHED",
        periods.slice(0, 2),
        3,
        now,
      ),
    ).toBe("NO_ACTIVE_PERIOD");
    expect(
      registrationClosedReason(scheduled, "PUBLISHED", periods, 10, now),
    ).toBe("FULL");
  });
});

describe("entrySummary", () => {
  it("counts approved and checked in, never withdrawn entries", () => {
    const e = (
      eligibility_status: MockEntry["eligibility_status"],
      checkin_status: MockEntry["checkin_status"],
      status: MockEntry["status"] = "REGISTERED",
    ) => ({ eligibility_status, checkin_status, status });
    expect(
      entrySummary([
        e("APPROVED", "CHECKED_IN"),
        e("APPROVED", "NOT_CHECKED_IN"),
        e("PENDING", "NOT_CHECKED_IN"),
        e("APPROVED", "CHECKED_IN", "WITHDRAWN"),
      ]),
    ).toEqual({ total: 3, approved: 2, checked_in: 1 });
  });
});
