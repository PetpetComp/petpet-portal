import { describe, expect, it } from "vitest";
import {
  competitionsCsvRows,
  overviewCsvRows,
  paidPercent,
  participantsCsvRows,
  reportFileName,
} from "./format";
import {
  eventReportFromApi,
  overviewFromApi,
  type ApiEventReport,
  type ApiReportsOverview,
} from "./types";

const api: ApiEventReport = {
  event_uuid: "e1",
  totals: {
    competitions: 2,
    entries: 5,
    paid_entries: 3,
    unpaid_entries: 2,
    checked_in: 1,
    revenue: 450000,
    sponsors: 4,
  },
  competitions: [
    {
      competition_uuid: "c1",
      name: "Glider Derby",
      type_code: "RACE",
      status: "ONGOING",
      entries: 3,
      paid_entries: 2,
      checked_in: 1,
      revenue: 300000,
    },
    {
      competition_uuid: "c2",
      name: "Beauty Class",
      type_code: "BEAUTY",
      status: "SCHEDULED",
      entries: 2,
      paid_entries: 1,
      checked_in: 0,
      revenue: 150000,
    },
  ],
  participants: [
    {
      entry_uuid: "n1",
      competition_name: "Glider Derby",
      bib_number: null,
      pet_name: null,
      owner_name: "Alya Maulana",
      payment_status: "PAID",
      checkin_status: "CHECKED_IN",
      registration_fee: 150000,
      registered_at: "2026-10-01T08:00:00+00:00",
    },
  ],
};

describe("paidPercent", () => {
  it("rounds to a whole percent and never divides by zero", () => {
    expect(paidPercent(12, 20)).toBe(60);
    expect(paidPercent(1, 3)).toBe(33);
    expect(paidPercent(0, 0)).toBe(0);
  });
});

describe("eventReportFromApi", () => {
  it("maps camelCase fields and fills blank names", () => {
    const report = eventReportFromApi(api);
    expect(report.totals.paidEntries).toBe(3);
    expect(report.competitions[0].typeCode).toBe("RACE");
    expect(report.participants[0].petName).toBe("Unnamed pet");
    expect(report.participants[0].bibNumber).toBe("");
  });
});

describe("CSV rows", () => {
  const report = eventReportFromApi(api);
  it("ends the competition summary with a Total row", () => {
    const rows = competitionsCsvRows(report);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({
      Competition: "Total",
      Entries: 5,
      Paid: 3,
      Revenue: 450000,
    });
  });
  it("writes readable payment and check-in words for participants", () => {
    expect(participantsCsvRows(report)[0]).toMatchObject({
      Payment: "Paid",
      "Checked in": "Yes",
      Fee: 150000,
    });
  });
  it("builds one overview row per event", () => {
    const overview = overviewFromApi({
      totals: {
        events: 1,
        competitions: 2,
        entries: 5,
        paid_entries: 3,
        revenue: 450000,
      },
      events: [
        {
          event_uuid: "e1",
          name: "Jakarta Pet Festival 2026",
          organization_name: "Petpet Org",
          status: "PUBLISHED",
          competitions: 2,
          entries: 5,
          paid_entries: 3,
          revenue: 450000,
        },
      ],
    } satisfies ApiReportsOverview);
    expect(overviewCsvRows(overview)[0]).toMatchObject({
      Event: "Jakarta Pet Festival 2026",
      Paid: 3,
    });
  });
});

describe("reportFileName", () => {
  it("makes a lowercase slug", () => {
    expect(reportFileName("participants", "Jakarta Pet Festival 2026")).toBe(
      "participants-jakarta-pet-festival-2026",
    );
    expect(reportFileName("x", "  Odd & Name! ")).toBe("x-odd-name");
  });
});
