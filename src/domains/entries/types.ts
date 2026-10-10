/** Backend enums of `entries` (petpet-service EntryService). */
export const ELIGIBILITY_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];
/** "PAID" is assumed: the backend only sets UNPAID so far (docs/09 §H). */
export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type CheckinStatus = "NOT_CHECKED_IN" | "CHECKED_IN";
export type EntryStatus = "REGISTERED" | "WITHDRAWN";

/** One entry exactly as the API sends it (petpet-service `EntryData::toArray`). */
export type ApiEntry = {
  uuid: string;
  competition_uuid: string;
  registration_period_uuid: string | null;
  owner_uuid: string;
  pet_uuid: string | null;
  team_uuid: string | null;
  bib_number: string | null;
  registration_fee: number | string;
  eligibility_status: EligibilityStatus;
  payment_status: PaymentStatus;
  checkin_status: CheckinStatus;
  status: EntryStatus;
  /** Proposed in docs/09 §H; not sent by the backend yet. */
  pet_name?: string | null;
  /** Proposed in docs/09 §H; not sent by the backend yet. */
  owner_name?: string | null;
};

/** `GET /competitions/{uuid}/registration-periods` item. */
export type ApiRegistrationPeriod = {
  uuid: string;
  competition_uuid: string;
  period_type: "EARLY_BIRD" | "ONLINE" | "ON_SITE";
  price: number | string;
  quota: number | null;
  registration_start_at: string;
  registration_end_at: string;
  status?: string;
};

export type Entry = {
  id: string;
  competitionId: string;
  petId: string | null;
  petName: string;
  ownerName: string;
  bib: string;
  fee: number;
  eligibility: EligibilityStatus;
  payment: PaymentStatus;
  checkin: CheckinStatus;
  withdrawn: boolean;
};

export type RegistrationPeriod = {
  id: string;
  type: ApiRegistrationPeriod["period_type"];
  price: number;
  opensAt: string;
  closesAt: string;
};

const short = (uuid: string | null) => (uuid ? uuid.slice(0, 8) : "");

export function fromApi(row: ApiEntry): Entry {
  return {
    id: row.uuid,
    competitionId: row.competition_uuid,
    petId: row.pet_uuid,
    // Until the API sends names, show a short id so rows stay tellable apart.
    petName:
      row.pet_name ?? (row.team_uuid ? "Team" : `Pet ${short(row.pet_uuid)}`),
    ownerName: row.owner_name ?? `User ${short(row.owner_uuid)}`,
    bib: row.bib_number ?? "",
    fee: Number(row.registration_fee) || 0,
    eligibility: row.eligibility_status,
    payment: row.payment_status,
    checkin: row.checkin_status,
    withdrawn: row.status === "WITHDRAWN",
  };
}

export const periodFromApi = (
  row: ApiRegistrationPeriod,
): RegistrationPeriod => ({
  id: row.uuid,
  type: row.period_type,
  price: Number(row.price) || 0,
  opensAt: row.registration_start_at,
  closesAt: row.registration_end_at,
});

/** The channel open right now; on-the-spot wins when several overlap. */
export function openPeriod(
  periods: RegistrationPeriod[],
  now: Date,
): RegistrationPeriod | null {
  const t = now.getTime();
  const open = periods.filter(
    (p) =>
      new Date(p.opensAt).getTime() <= t && t <= new Date(p.closesAt).getTime(),
  );
  return open.find((p) => p.type === "ON_SITE") ?? open[0] ?? null;
}
