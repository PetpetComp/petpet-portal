import type { ApiPageMeta } from "@/types/api";
import type { Meta } from "@/types/common";

/** Backend enums of `entries` (petpet-service `EntryConstant`). */
export const ELIGIBILITY_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CHECKIN_STATUSES = ["NOT_CHECKED_IN", "CHECKED_IN"] as const;
export type CheckinStatus = (typeof CHECKIN_STATUSES)[number];

export const ENTRY_STATUSES = ["REGISTERED", "WITHDRAWN"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** `sort` values of `GET /events/{uuid}/entries` (contract 10 §2.1). */
export const ENTRY_SORTS = [
  "registered_at",
  "pet_name",
  "owner_name",
  "bib_number",
  "participant_code",
] as const;
export type EntrySort = (typeof ENTRY_SORTS)[number];
export type SortDirection = "asc" | "desc";

/** "Pending" reads as "waiting for review" to the committee. */
export const ELIGIBILITY_LABEL: Record<EligibilityStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

export const CHECKIN_LABEL: Record<CheckinStatus, string> = {
  NOT_CHECKED_IN: "Not checked in",
  CHECKED_IN: "Checked in",
};

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  REGISTERED: "Registered",
  WITHDRAWN: "Withdrawn",
};

/** What the caller may do with this entry (backend `EntryActions`). */
export type ApiEntryActions = {
  approve: boolean;
  reject: boolean;
  check_in: boolean;
  undo_check_in: boolean;
  withdraw: boolean;
};

/** One entry exactly as the API sends it (petpet-service `EntryData::toArray`, contract 10 §1). */
export type ApiEntry = {
  uuid: string;
  participant_code: string | null;
  competition_uuid: string;
  competition_name: string;
  registration_period_uuid: string | null;
  owner_uuid: string;
  owner_name: string;
  owner_phone: string | null;
  pet_uuid: string | null;
  pet_name: string | null;
  pet_morph_name: string | null;
  team_uuid: string | null;
  bib_number: string | null;
  /** Decimal string, e.g. "75000.00". */
  registration_fee: string;
  eligibility_status: EligibilityStatus;
  payment_status: PaymentStatus;
  checkin_status: CheckinStatus;
  status: EntryStatus;
  registered_at: string;
  checked_in_at: string | null;
  actions: ApiEntryActions;
};

/** Counts over the event (+ `competition_id`), without withdrawn entries. */
export type ApiEntrySummary = {
  total: number;
  approved: number;
  checked_in: number;
};

/** `data` of `GET /events/{uuid}/entries`. */
export type ApiEventEntries = {
  items: ApiEntry[];
  meta: ApiPageMeta;
  summary: ApiEntrySummary;
};

export type ApiOwnerPet = {
  uuid: string;
  name: string;
  species_name: string;
  morph_name: string | null;
};

/** `GET /events/{uuid}/owner-search` item (contract 10 §2.5). */
export type ApiOwnerSearchResult = {
  uuid: string;
  name: string;
  email: string;
  phone: string | null;
  pets: ApiOwnerPet[];
};

/** Screen shapes, built only by the mappers below. */
export type EntryActions = {
  approve: boolean;
  reject: boolean;
  checkIn: boolean;
  undoCheckIn: boolean;
  withdraw: boolean;
};

export type Entry = {
  id: string;
  participantCode: string | null;
  competitionId: string;
  competitionName: string;
  registrationPeriodId: string | null;
  ownerId: string;
  ownerName: string;
  ownerPhone: string | null;
  petId: string | null;
  /** Null for team entries. */
  petName: string | null;
  petMorphName: string | null;
  teamId: string | null;
  bib: string | null;
  fee: number;
  eligibility: EligibilityStatus;
  payment: PaymentStatus;
  checkin: CheckinStatus;
  status: EntryStatus;
  registeredAt: string;
  checkedInAt: string | null;
  actions: EntryActions;
};

export type EntrySummary = {
  total: number;
  approved: number;
  checkedIn: number;
};

export type EventEntries = {
  items: Entry[];
  meta: Meta;
  summary: EntrySummary;
};

export type OwnerPet = {
  id: string;
  name: string;
  speciesName: string;
  morphName: string | null;
};

export type Owner = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  pets: OwnerPet[];
};

/** Server-side filters, sort and paging of the event entries list. `page` is 1-based. */
export type EntryListQuery = {
  competitionId?: string;
  eligibility?: EligibilityStatus;
  payment?: PaymentStatus;
  checkin?: CheckinStatus;
  status?: EntryStatus;
  q?: string;
  sort?: EntrySort;
  direction?: SortDirection;
  page: number;
  perPage: number;
};

export function fromApi(row: ApiEntry): Entry {
  return {
    id: row.uuid,
    participantCode: row.participant_code,
    competitionId: row.competition_uuid,
    competitionName: row.competition_name,
    registrationPeriodId: row.registration_period_uuid,
    ownerId: row.owner_uuid,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
    petId: row.pet_uuid,
    petName: row.pet_name,
    petMorphName: row.pet_morph_name,
    teamId: row.team_uuid,
    bib: row.bib_number,
    fee: Number(row.registration_fee),
    eligibility: row.eligibility_status,
    payment: row.payment_status,
    checkin: row.checkin_status,
    status: row.status,
    registeredAt: row.registered_at,
    checkedInAt: row.checked_in_at,
    actions: {
      approve: row.actions.approve,
      reject: row.actions.reject,
      checkIn: row.actions.check_in,
      undoCheckIn: row.actions.undo_check_in,
      withdraw: row.actions.withdraw,
    },
  };
}

export function eventEntriesFromApi(data: ApiEventEntries): EventEntries {
  return {
    items: data.items.map(fromApi),
    meta: {
      currentPage: data.meta.current_page,
      perPage: data.meta.per_page,
      total: data.meta.total,
      lastPage: data.meta.last_page,
    },
    summary: {
      total: data.summary.total,
      approved: data.summary.approved,
      checkedIn: data.summary.checked_in,
    },
  };
}

export const ownerFromApi = (row: ApiOwnerSearchResult): Owner => ({
  id: row.uuid,
  name: row.name,
  email: row.email,
  phone: row.phone,
  pets: row.pets.map((p) => ({
    id: p.uuid,
    name: p.name,
    speciesName: p.species_name,
    morphName: p.morph_name,
  })),
});

/** Query string of `GET /events/{uuid}/entries`; `buildUrl` drops empty values. */
export function entryListParams(query: EntryListQuery) {
  return {
    competition_id: query.competitionId,
    eligibility_status: query.eligibility,
    payment_status: query.payment,
    checkin_status: query.checkin,
    status: query.status,
    q: query.q?.trim(),
    sort: query.sort,
    direction: query.direction,
    page: query.page,
    per_page: query.perPage,
  };
}
