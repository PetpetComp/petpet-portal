import type { Competition } from "@/domains/competitions/types";
import type { Entry, EventEntries } from "@/domains/entries/types";

/** Screen-shape builders for component tests. */
export function competitionFixture(
  over: Partial<Competition> = {},
): Competition {
  return {
    id: "c1",
    eventId: "e1",
    typeId: "ct1",
    name: "Paw Sprint",
    arenaName: "",
    capacity: 40,
    startAt: "",
    endAt: "",
    registrationClosed: false,
    registrationOpen: true,
    registrationClosedReason: null,
    activeRegistrationPeriod: null,
    status: "SCHEDULED",
    actions: {
      publish: false,
      start: false,
      complete: false,
      closeRegistration: false,
      cancel: false,
    },
    ...over,
  };
}

export function entryFixture(over: Partial<Entry> = {}): Entry {
  return {
    id: "en1",
    participantCode: null,
    competitionId: "c1",
    competitionName: "Paw Sprint",
    registrationPeriodId: null,
    ownerId: "u1",
    ownerName: "Rani",
    ownerPhone: null,
    petId: "p1",
    petName: "Bolt",
    petMorphName: null,
    teamId: null,
    bib: null,
    fee: 65000,
    eligibility: "PENDING",
    payment: "UNPAID",
    checkin: "NOT_CHECKED_IN",
    status: "REGISTERED",
    registeredAt: "2026-10-10T08:00:00+00:00",
    checkedInAt: null,
    actions: {
      approve: false,
      reject: false,
      markPaid: false,
      checkIn: false,
      undoCheckIn: false,
      withdraw: false,
    },
    ...over,
  };
}

export function entriesPage(
  items: Entry[],
  summary = { total: items.length, approved: 0, checkedIn: 0 },
): EventEntries {
  return {
    items,
    meta: { currentPage: 1, perPage: 10, total: items.length, lastPage: 1 },
    summary,
  };
}
