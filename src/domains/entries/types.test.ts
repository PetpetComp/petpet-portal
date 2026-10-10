import { describe, expect, it } from "vitest";
import {
  entryListParams,
  eventEntriesFromApi,
  fromApi,
  ownerFromApi,
  type ApiEntry,
} from "./types";

const row: ApiEntry = {
  uuid: "en1",
  participant_code: "PTC-12-001",
  competition_uuid: "c1",
  competition_name: "Beauty Class Open",
  registration_period_uuid: "per1",
  owner_uuid: "u1",
  owner_name: "Alya Maulana",
  owner_phone: null,
  pet_uuid: "p1",
  pet_name: "Chibi",
  pet_morph_name: "Classic Grey",
  team_uuid: null,
  bib_number: "001",
  registration_fee: "75000.00",
  eligibility_status: "APPROVED",
  payment_status: "UNPAID",
  checkin_status: "NOT_CHECKED_IN",
  status: "REGISTERED",
  registered_at: "2026-10-10T08:12:00+00:00",
  checked_in_at: null,
  actions: {
    approve: false,
    reject: false,
    mark_paid: true,
    check_in: true,
    undo_check_in: false,
    withdraw: false,
  },
};

describe("entries fromApi", () => {
  it("maps every field and parses the decimal fee", () => {
    expect(fromApi(row)).toEqual({
      id: "en1",
      participantCode: "PTC-12-001",
      competitionId: "c1",
      competitionName: "Beauty Class Open",
      registrationPeriodId: "per1",
      ownerId: "u1",
      ownerName: "Alya Maulana",
      ownerPhone: null,
      petId: "p1",
      petName: "Chibi",
      petMorphName: "Classic Grey",
      teamId: null,
      bib: "001",
      fee: 75000,
      eligibility: "APPROVED",
      payment: "UNPAID",
      checkin: "NOT_CHECKED_IN",
      status: "REGISTERED",
      registeredAt: "2026-10-10T08:12:00+00:00",
      checkedInAt: null,
      actions: {
        approve: false,
        reject: false,
        markPaid: true,
        checkIn: true,
        undoCheckIn: false,
        withdraw: false,
      },
    });
  });

  it("keeps nulls as nulls (no placeholder names)", () => {
    const team = fromApi({
      ...row,
      pet_uuid: null,
      pet_name: null,
      pet_morph_name: null,
      team_uuid: "t1",
    });
    expect(team).toMatchObject({
      petName: null,
      petMorphName: null,
      teamId: "t1",
    });
  });
});

describe("eventEntriesFromApi", () => {
  it("maps items, meta and summary", () => {
    const list = eventEntriesFromApi({
      items: [row],
      meta: { current_page: 2, per_page: 15, total: 42, last_page: 3 },
      summary: { total: 40, approved: 31, checked_in: 12 },
    });
    expect(list.items[0].id).toBe("en1");
    expect(list.meta).toEqual({
      currentPage: 2,
      perPage: 15,
      total: 42,
      lastPage: 3,
    });
    expect(list.summary).toEqual({ total: 40, approved: 31, checkedIn: 12 });
  });
});

describe("ownerFromApi", () => {
  it("maps the owner and their pets", () => {
    expect(
      ownerFromApi({
        uuid: "u1",
        name: "Alya Maulana",
        email: "alya@x.dev",
        phone: "0812",
        pets: [
          {
            uuid: "p1",
            name: "Chibi",
            species_name: "Sugar Glider",
            morph_name: "Classic Grey",
          },
        ],
      }),
    ).toEqual({
      id: "u1",
      name: "Alya Maulana",
      email: "alya@x.dev",
      phone: "0812",
      pets: [
        {
          id: "p1",
          name: "Chibi",
          speciesName: "Sugar Glider",
          morphName: "Classic Grey",
        },
      ],
    });
  });
});

describe("entryListParams", () => {
  it("uses the contract's query names", () => {
    expect(
      entryListParams({
        competitionId: "c1",
        eligibility: "APPROVED",
        payment: "PAID",
        checkin: "CHECKED_IN",
        status: "REGISTERED",
        q: "  PTC-12-001 ",
        sort: "pet_name",
        direction: "asc",
        page: 2,
        perPage: 12,
      }),
    ).toEqual({
      competition_id: "c1",
      eligibility_status: "APPROVED",
      payment_status: "PAID",
      checkin_status: "CHECKED_IN",
      status: "REGISTERED",
      q: "PTC-12-001",
      sort: "pet_name",
      direction: "asc",
      page: 2,
      per_page: 12,
    });
  });
});
