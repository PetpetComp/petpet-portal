import { describe, expect, it } from "vitest";
import {
  fromApi,
  openPeriod,
  type ApiEntry,
  type RegistrationPeriod,
} from "./types";

const row: ApiEntry = {
  uuid: "en1",
  competition_uuid: "c1",
  registration_period_uuid: null,
  owner_uuid: "4f6a2b1c-0000",
  pet_uuid: "9d8e7f6a-0000",
  team_uuid: null,
  bib_number: null,
  registration_fee: "65000.00",
  eligibility_status: "PENDING",
  payment_status: "UNPAID",
  checkin_status: "NOT_CHECKED_IN",
  status: "REGISTERED",
};

describe("entries fromApi", () => {
  it("uses names when the API sends them", () => {
    expect(
      fromApi({ ...row, pet_name: "Bolt", owner_name: "Rani" }),
    ).toMatchObject({
      petName: "Bolt",
      ownerName: "Rani",
      fee: 65000,
    });
  });
  it("falls back to short ids while the API has no names", () => {
    expect(fromApi(row)).toMatchObject({
      petName: "Pet 9d8e7f6a",
      ownerName: "User 4f6a2b1c",
    });
  });
});

describe("openPeriod", () => {
  const p = (
    type: RegistrationPeriod["type"],
    opensAt: string,
    closesAt: string,
  ): RegistrationPeriod => ({
    id: type,
    type,
    price: 0,
    opensAt,
    closesAt,
  });
  const now = new Date("2026-09-04T10:00:00Z");
  it("picks the channel whose window contains now", () => {
    const periods = [
      p("EARLY_BIRD", "2026-08-01T00:00:00Z", "2026-08-20T00:00:00Z"),
      p("ONLINE", "2026-08-20T00:00:00Z", "2026-09-10T00:00:00Z"),
    ];
    expect(openPeriod(periods, now)?.type).toBe("ONLINE");
  });
  it("prefers on-the-spot when several are open", () => {
    const periods = [
      p("ONLINE", "2026-08-20T00:00:00Z", "2026-09-10T00:00:00Z"),
      p("ON_SITE", "2026-09-04T00:00:00Z", "2026-09-04T23:00:00Z"),
    ];
    expect(openPeriod(periods, now)?.type).toBe("ON_SITE");
  });
  it("returns null when registration is closed", () => {
    expect(
      openPeriod(
        [p("ONLINE", "2026-08-01T00:00:00Z", "2026-08-02T00:00:00Z")],
        now,
      ),
    ).toBeNull();
  });
});
