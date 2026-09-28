import type {
  MockUser,
  MockOrganization,
  MockEvent,
  MockCompetition,
  MockPet,
  MockSponsor,
  MockEventSponsor,
  MockEntry,
} from "./mock-types";

export function nextUuid(): string {
  return crypto.randomUUID();
}

const SUPERADMIN_UUID = "u-superadmin";
const ORGANIZER_UUID = "u-organizer";
const COMPETITOR_UUID = "u-competitor";
const SPONSOR_USER_UUID = "u-sponsor";
const ORG_UUID = "org-petpet-community";
const EVENT_UUID = "evt-jakarta-pet-festival";
const COMPETITION_UUID = "comp-agility-sprint";
const PET_UUID = "pet-bolt";
const SPONSOR_UUID = "spo-whiskas-indonesia";

export const DEMO_PASSWORD = "password123";

export const store = {
  users: [
    {
      uuid: SUPERADMIN_UUID,
      username: "admin",
      email: "admin@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Petpet",
      last_name: "Admin",
      status: "Active",
    },
    {
      uuid: ORGANIZER_UUID,
      username: "organizer",
      email: "organizer@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Organizer",
      last_name: "Demo",
      status: "Active",
    },
    {
      uuid: COMPETITOR_UUID,
      username: "competitor",
      email: "competitor@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Competitor",
      last_name: "Demo",
      status: "Active",
    },
    {
      uuid: SPONSOR_USER_UUID,
      username: "sponsor",
      email: "sponsor@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Sponsor",
      last_name: "Demo",
      status: "Active",
    },
  ] as MockUser[],

  organizations: [
    {
      uuid: ORG_UUID,
      name: "Petpet Community",
      email: "contact@petpetcommunity.dev",
      pics: [{ uuid: "pic-org-1", name: "Organizer Demo", user_uuid: ORGANIZER_UUID }],
    },
  ] as MockOrganization[],

  events: [
    {
      uuid: EVENT_UUID,
      organization_uuid: ORG_UUID,
      name: "Jakarta Pet Festival 2026",
      tagline: "Where every paw wins",
      venue_name: "JIExpo Kemayoran",
      venue_address: "Jl. Benyamin Suaeb, Jakarta",
      timezone: "Asia/Jakarta",
      start_at: "2026-11-05T08:00:00+07:00",
      end_at: "2026-11-06T18:00:00+07:00",
      status: "Published",
    },
  ] as MockEvent[],

  competitions: [
    {
      uuid: COMPETITION_UUID,
      event_uuid: EVENT_UUID,
      name: "Agility Sprint",
      arena_name: "Main Arena",
      capacity: 40,
      scheduled_start_at: "2026-11-05T09:00:00+07:00",
      scheduled_end_at: "2026-11-05T15:00:00+07:00",
      registration_closed_at: null,
      status: "Open",
    },
  ] as MockCompetition[],

  pets: [
    {
      uuid: PET_UUID,
      owner_uuid: COMPETITOR_UUID,
      name: "Bolt",
      gender: "Male",
      birth_date: "2023-02-10",
      status: "Active",
    },
  ] as MockPet[],

  sponsors: [
    {
      uuid: SPONSOR_UUID,
      brand_name: "Whiskas Indonesia",
      email: "partnership@whiskas.example",
      status: "Active",
      pics: [{ uuid: "pic-1", name: "Sponsor Demo", user_uuid: SPONSOR_USER_UUID }],
    },
  ] as MockSponsor[],

  eventSponsors: [] as MockEventSponsor[],

  entries: [
    {
      uuid: "entry-bolt-agility",
      competition_uuid: COMPETITION_UUID,
      owner_uuid: COMPETITOR_UUID,
      pet_uuid: PET_UUID,
      bib_number: "001",
      payment_status: "Paid",
      checkin_status: "Pending",
      status: "Approved",
    },
  ] as MockEntry[],
};

export const SUPERADMIN_EMAILS = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? "admin@petpet.dev"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function paginate<T>(
  items: T[],
  query: URLSearchParams,
): {
  items: T[];
  meta: { current_page: number; per_page: number; total: number; last_page: number };
} {
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const perPage = Math.max(1, Number(query.get("per_page") ?? 20) || 20);
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    meta: {
      current_page: page,
      per_page: perPage,
      total: items.length,
      last_page: Math.max(1, Math.ceil(items.length / perPage)),
    },
  };
}

export function findOrThrow<T extends { uuid: string }>(
  list: T[],
  uuid: string,
  label: string,
): T {
  const record = list.find((item) => item.uuid === uuid);
  if (!record) throw new Error(label + " not found: " + uuid);
  return record;
}
