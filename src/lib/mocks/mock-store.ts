import type {
  MockUser,
  MockOrganization,
  MockEvent,
  MockCompetition,
  MockPet,
  MockSponsor,
  MockEventSponsor,
  MockEntry,
  MockPetMorph,
  MockRegistrationPeriod,
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

/** Event-day demo: Jakarta Pet Festival has one competition per lifecycle status. */
const BEAUTY_UUID = "comp-beauty-class-open";
const OBEDIENCE_UUID = "comp-obedience-trial";
const MINI_AGILITY_UUID = "comp-glider-mini-agility";
const COSTUME_UUID = "comp-costume-parade";
const FUN_RUN_UUID = "comp-puppy-fun-run";
const CAT_RELAY_UUID = "comp-cat-agility-relay";

/** Sugar glider owners of the event-day dataset: [uuid, username, first, last, phone]. */
const GLIDER_OWNERS: [string, string, string, string, string][] = [
  ["u-alya", "alya.maulana", "Alya", "Maulana", "081311110001"],
  ["u-bagas", "bagas.hakim", "Bagas", "Hakim", "081311110002"],
  ["u-citra-l", "citra.lestari", "Citra", "Lestari", "081311110003"],
  ["u-citra-p", "citra.permana", "Citra", "Permana", "081311110004"],
  ["u-damar-p", "damar.prakoso", "Damar", "Prakoso", "081311110005"],
  ["u-damar-w", "damar.wijaya", "Damar", "Wijaya", "081311110006"],
  ["u-eka-s", "eka.saputra", "Eka", "Saputra", "081311110007"],
  ["u-eka-u", "eka.utami", "Eka", "Utami", "081311110008"],
  ["u-fajar", "fajar.nugroho", "Fajar", "Nugroho", "081311110009"],
  ["u-gita", "gita.rahma", "Gita", "Rahma", "081311110010"],
  ["u-hendra", "hendra.kurnia", "Hendra", "Kurnia", "081311110011"],
  ["u-indah", "indah.sari", "Indah", "Sari", "081311110012"],
];

/** [pet uuid, name, owner uuid, morph uuid] */
const GLIDER_PETS: [string, string, string, string][] = [
  ["pet-chibi", "Chibi", "u-alya", "morph-classic-grey"],
  ["pet-puffy", "Puffy", "u-bagas", "morph-mosaic"],
  ["pet-sora", "Sora", "u-citra-l", "morph-bfbb"],
  ["pet-mika", "Mika", "u-citra-p", "morph-cremino"],
  ["pet-nana", "Nana", "u-damar-p", "morph-caramel"],
  ["pet-niko", "Niko", "u-damar-w", "morph-caramel"],
  ["pet-kona", "Kona", "u-eka-s", "morph-ringtail-mosaic"],
  ["pet-kiwi", "Kiwi", "u-eka-u", "morph-ringtail-mosaic"],
  ["pet-lulu", "Lulu", "u-fajar", "morph-leucistic"],
  ["pet-momo", "Momo", "u-gita", "morph-platinum"],
  ["pet-pipi", "Pipi", "u-hendra", "morph-classic-grey"],
  ["pet-tofu", "Tofu", "u-indah", "morph-leucistic"],
  ["pet-bubu", "Bubu", "u-alya", "morph-mosaic"],
  ["pet-dodo", "Dodo", "u-bagas", "morph-classic-grey"],
  ["pet-gigi", "Gigi", "u-citra-l", "morph-platinum"],
  ["pet-hana", "Hana", "u-damar-p", "morph-cremino"],
  ["pet-yuki", "Yuki", "u-eka-s", "morph-leucistic"],
  ["pet-ziggy", "Ziggy", "u-fajar", "morph-bfbb"],
  ["pet-ochi", "Ochi", "u-gita", "morph-caramel"],
  ["pet-rara", "Rara", "u-hendra", "morph-mosaic"],
  ["pet-suki", "Suki", "u-indah", "morph-classic-grey"],
  ["pet-ubi", "Ubi", "u-eka-u", "morph-platinum"],
];

const pets: MockPet[] = [
  {
    uuid: PET_UUID,
    owner_uuid: COMPETITOR_UUID,
    name: "Bolt",
    species_uuid: "sp-dog",
    morph_uuid: "morph-border-collie",
    gender: "Male",
    birth_date: "2023-02-10",
    status: "Active",
  },
  {
    uuid: "pet-luna",
    owner_uuid: COMPETITOR_UUID,
    name: "Luna",
    species_uuid: "sp-dog",
    morph_uuid: "morph-golden-retriever",
    gender: "Female",
    birth_date: "2022-06-18",
    status: "Active",
  },
  {
    uuid: "pet-milo",
    owner_uuid: "u-competitor-2",
    name: "Milo",
    species_uuid: "sp-cat",
    morph_uuid: "morph-persian",
    gender: "Male",
    birth_date: "2021-11-02",
    status: "Active",
  },
  {
    uuid: "pet-coco",
    owner_uuid: "u-competitor-2",
    name: "Coco",
    species_uuid: "sp-cat",
    morph_uuid: "morph-british-shorthair",
    gender: "Female",
    birth_date: "2023-04-25",
    status: "Active",
  },
  {
    uuid: "pet-rocky",
    owner_uuid: "u-competitor-3",
    name: "Rocky",
    species_uuid: "sp-dog",
    morph_uuid: "morph-shiba-inu",
    gender: "Male",
    birth_date: "2020-09-14",
    status: "Active",
  },
  {
    uuid: "pet-mochi",
    owner_uuid: "u-competitor-3",
    name: "Mochi",
    species_uuid: "sp-dog",
    morph_uuid: "morph-shiba-inu",
    gender: "Female",
    birth_date: "2022-01-30",
    status: "Active",
  },
  {
    uuid: "pet-simba",
    owner_uuid: "u-competitor-4",
    name: "Simba",
    species_uuid: "sp-cat",
    morph_uuid: "morph-maine-coon",
    gender: "Male",
    birth_date: "2021-05-08",
    status: "Active",
  },
  {
    uuid: "pet-nala",
    owner_uuid: "u-competitor-4",
    name: "Nala",
    species_uuid: "sp-cat",
    morph_uuid: "morph-persian",
    gender: "Female",
    birth_date: "2023-08-19",
    status: "Active",
  },
  {
    uuid: "pet-oreo",
    owner_uuid: "u-competitor-5",
    name: "Oreo",
    species_uuid: "sp-dog",
    morph_uuid: "morph-border-collie",
    gender: "Male",
    birth_date: "2022-12-01",
    status: "Inactive",
  },
  {
    uuid: "pet-kiki",
    owner_uuid: "u-competitor-5",
    name: "Kiki",
    species_uuid: "sp-cat",
    morph_uuid: "morph-british-shorthair",
    gender: "Female",
    birth_date: "2021-03-22",
    status: "Active",
  },
  ...GLIDER_PETS.map(([uuid, name, owner_uuid, morph_uuid]) => ({
    uuid,
    owner_uuid,
    name,
    species_uuid: "sp-sugar-glider",
    morph_uuid,
    status: "Active",
  })),
];

type Seed = Pick<
  MockEntry,
  "eligibility_status" | "payment_status" | "checkin_status"
> & { withdrawn?: boolean };

const APPROVED: Seed = {
  eligibility_status: "APPROVED",
  payment_status: "PAID",
  checkin_status: "NOT_CHECKED_IN",
};
const CHECKED_IN: Seed = { ...APPROVED, checkin_status: "CHECKED_IN" };
const PENDING: Seed = {
  eligibility_status: "PENDING",
  payment_status: "UNPAID",
  checkin_status: "NOT_CHECKED_IN",
};

/**
 * Entries of one competition. `no` numbers the competition in participant
 * codes (PTC-21-001); registration times step back an hour per entry.
 */
function seedEntries(
  competitionUuid: string,
  no: number,
  fee: number,
  periodUuid: string | null,
  rows: [string, Seed][],
): MockEntry[] {
  return rows.map(([petUuid, seed], i) => {
    const pet = pets.find((p) => p.uuid === petUuid)!;
    const n = String(i + 1).padStart(3, "0");
    const registered = new Date(Date.UTC(2026, 8, 30, 12) - i * 3_600_000);
    return {
      uuid: `entry-${competitionUuid.replace(/^comp-/, "")}-${n}`,
      participant_code: `PTC-${no}-${n}`,
      competition_uuid: competitionUuid,
      owner_uuid: pet.owner_uuid,
      pet_uuid: pet.uuid,
      team_uuid: null,
      registration_period_uuid: periodUuid,
      bib_number: n,
      registration_fee: fee,
      eligibility_status: seed.eligibility_status,
      payment_status: seed.payment_status,
      checkin_status: seed.checkin_status,
      status: seed.withdrawn ? "WITHDRAWN" : "REGISTERED",
      registered_at: registered.toISOString().replace(".000Z", "+00:00"),
      checked_in_at:
        seed.checkin_status === "CHECKED_IN"
          ? "2026-10-10T07:15:00+00:00"
          : null,
      registered_by_uuid: pet.owner_uuid,
    };
  });
}

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
      phone: "081200000001",
      status: "Active",
    },
    {
      uuid: COMPETITOR_UUID,
      username: "competitor",
      email: "competitor@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Competitor",
      last_name: "Demo",
      phone: "081200000002",
      status: "Active",
    },
    {
      uuid: SPONSOR_USER_UUID,
      username: "sponsor",
      email: "sponsor@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Sponsor",
      last_name: "Demo",
      phone: "081200000003",
      status: "Active",
    },
    {
      uuid: "u-organizer-2",
      username: "dian.kusuma",
      email: "dian.kusuma@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Dian",
      last_name: "Kusuma",
      phone: "081211110001",
      status: "Active",
    },
    {
      uuid: "u-organizer-3",
      username: "bima.saputra",
      email: "bima.saputra@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Bima",
      last_name: "Saputra",
      phone: "081211110002",
      status: "Active",
    },
    {
      uuid: "u-competitor-2",
      username: "sari.wulandari",
      email: "sari.wulandari@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Sari",
      last_name: "Wulandari",
      phone: "081222220001",
      status: "Active",
    },
    {
      uuid: "u-competitor-3",
      username: "rangga.putra",
      email: "rangga.putra@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Rangga",
      last_name: "Putra",
      phone: "081222220002",
      status: "Active",
    },
    {
      uuid: "u-competitor-4",
      username: "citra.ayu",
      email: "citra.ayu@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Citra",
      last_name: "Ayu",
      phone: "081222220003",
      status: "Active",
    },
    {
      uuid: "u-competitor-5",
      username: "farhan.hidayat",
      email: "farhan.hidayat@petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Farhan",
      last_name: "Hidayat",
      phone: "081222220004",
      status: "Inactive",
    },
    {
      uuid: "u-sponsor-2",
      username: "royal.canin.id",
      email: "partnership@royalcanin.petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Wulan",
      last_name: "Anggraini",
      phone: "081233330001",
      status: "Active",
    },
    {
      uuid: "u-sponsor-3",
      username: "petplus.store",
      email: "sponsorship@petplus.petpet.dev",
      password: DEMO_PASSWORD,
      first_name: "Agus",
      last_name: "Prasetyo",
      phone: "081233330002",
      status: "Active",
    },
    ...GLIDER_OWNERS.map(([uuid, username, first_name, last_name, phone]) => ({
      uuid,
      username,
      email: `${username}@petpet.dev`,
      password: DEMO_PASSWORD,
      first_name,
      last_name,
      phone,
      status: "Active",
    })),
  ] as MockUser[],

  organizations: [
    {
      uuid: ORG_UUID,
      name: "Petpet Community",
      email: "contact@petpetcommunity.dev",
      phone: "0215500001",
      pics: [
        {
          uuid: "pic-org-1",
          name: "Organizer Demo",
          user_uuid: ORGANIZER_UUID,
        },
      ],
    },
    {
      uuid: "org-jakarta-cat-lovers",
      name: "Jakarta Cat Lovers Club",
      email: "hello@jakartacatlovers.dev",
      phone: "0215500002",
      pics: [
        { uuid: "pic-org-2", name: "Dian Kusuma", user_uuid: "u-organizer-2" },
      ],
    },
    {
      uuid: "org-surabaya-pet-sports",
      name: "Surabaya Pet Sports Association",
      email: "info@surabayapetsports.dev",
      phone: "0315500003",
      pics: [
        { uuid: "pic-org-3", name: "Bima Saputra", user_uuid: "u-organizer-3" },
      ],
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
      start_at: "2026-10-05T08:00:00+07:00",
      end_at: "2026-11-06T18:00:00+07:00",
      status: "Published",
    },
    {
      uuid: "evt-jakarta-cat-show",
      organization_uuid: "org-jakarta-cat-lovers",
      name: "Jakarta Cat Show 2026",
      tagline: "Celebrating every whisker",
      venue_name: "Senayan City Hall",
      venue_address: "Jl. Asia Afrika, Jakarta",
      timezone: "Asia/Jakarta",
      start_at: "2026-09-20T09:00:00+07:00",
      end_at: "2026-09-21T17:00:00+07:00",
      status: "Published",
    },
    {
      uuid: "evt-surabaya-paw-race",
      organization_uuid: "org-surabaya-pet-sports",
      name: "Surabaya Paw Race 2026",
      tagline: "Run fast, wag harder",
      venue_name: "Gelora Bung Tomo",
      venue_address: "Jl. Benowo, Surabaya",
      timezone: "Asia/Jakarta",
      start_at: "2026-08-15T07:00:00+07:00",
      end_at: "2026-08-15T16:00:00+07:00",
      status: "Published",
    },
    {
      uuid: "evt-bandung-dog-agility",
      organization_uuid: ORG_UUID,
      name: "Bandung Dog Agility Open",
      tagline: "Jump, weave, win",
      venue_name: "Sasana Budaya Ganesha",
      venue_address: "Jl. Taman Sari, Bandung",
      timezone: "Asia/Jakarta",
      start_at: "2026-12-10T08:00:00+07:00",
      end_at: "2026-12-10T17:00:00+07:00",
      status: "Draft",
    },
    {
      uuid: "evt-bali-exotic-pet-expo",
      organization_uuid: "org-jakarta-cat-lovers",
      name: "Bali Exotic Pet Expo 2026",
      tagline: "Wild hearts, gentle hands",
      venue_name: "Sanur Beach Convention Hall",
      venue_address: "Jl. Danau Tamblingan, Denpasar",
      timezone: "Asia/Makassar",
      start_at: "2026-10-03T09:00:00+08:00",
      end_at: "2026-10-04T18:00:00+08:00",
      status: "Published",
    },
    {
      uuid: "evt-yogya-pet-carnival",
      organization_uuid: "org-surabaya-pet-sports",
      name: "Yogyakarta Pet Carnival 2026",
      tagline: "A parade of paws",
      venue_name: "Jogja Expo Center",
      venue_address: "Jl. Janti, Yogyakarta",
      timezone: "Asia/Jakarta",
      start_at: "2026-07-01T08:00:00+07:00",
      end_at: "2026-07-01T20:00:00+07:00",
      status: "Closed",
    },
    {
      uuid: "evt-medan-pet-championship",
      organization_uuid: ORG_UUID,
      name: "Medan Pet Championship 2026",
      tagline: "North Sumatra's finest",
      venue_name: "Tiara Convention Center",
      venue_address: "Jl. Imam Bonjol, Medan",
      timezone: "Asia/Jakarta",
      start_at: "2027-01-18T08:00:00+07:00",
      end_at: "2027-01-19T17:00:00+07:00",
      status: "Draft",
    },
  ] as MockEvent[],

  competitions: [
    {
      uuid: BEAUTY_UUID,
      competition_type_uuid: "ct-beauty",
      species_uuid: "sp-sugar-glider",
      event_uuid: EVENT_UUID,
      name: "Beauty Class Open",
      arena_name: "Stage 1",
      capacity: 40,
      minimum_judges: 3,
      scheduled_start_at: "2026-10-10T09:00:00+07:00",
      scheduled_end_at: "2026-10-10T15:00:00+07:00",
      registration_closed_at: null,
      status: "ONGOING",
    },
    {
      uuid: MINI_AGILITY_UUID,
      competition_type_uuid: "ct-time-trial",
      species_uuid: "sp-sugar-glider",
      event_uuid: EVENT_UUID,
      name: "Glider Mini Agility",
      arena_name: "Stage 2",
      capacity: 4,
      scheduled_start_at: "2026-10-12T10:00:00+07:00",
      scheduled_end_at: "2026-10-12T12:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: COSTUME_UUID,
      competition_type_uuid: "ct-beauty",
      event_uuid: EVENT_UUID,
      name: "Costume Parade",
      arena_name: "Main Arena",
      capacity: 50,
      scheduled_start_at: "2026-11-06T15:00:00+07:00",
      scheduled_end_at: "2026-11-06T17:00:00+07:00",
      registration_closed_at: null,
      status: "DRAFT",
    },
    {
      uuid: FUN_RUN_UUID,
      competition_type_uuid: "ct-race",
      species_uuid: "sp-dog",
      event_uuid: EVENT_UUID,
      name: "Puppy Fun Run",
      arena_name: "Track A",
      capacity: 20,
      scheduled_start_at: "2026-10-05T09:00:00+07:00",
      scheduled_end_at: "2026-10-05T11:00:00+07:00",
      registration_closed_at: "2026-10-04T17:00:00+07:00",
      status: "COMPLETED",
    },
    {
      uuid: CAT_RELAY_UUID,
      competition_type_uuid: "ct-race",
      species_uuid: "sp-cat",
      event_uuid: EVENT_UUID,
      name: "Cat Agility Relay",
      arena_name: "Track B",
      capacity: 16,
      scheduled_start_at: "2026-10-11T13:00:00+07:00",
      scheduled_end_at: "2026-10-11T15:00:00+07:00",
      registration_closed_at: null,
      status: "CANCELLED",
    },
    {
      uuid: COMPETITION_UUID,
      competition_type_uuid: "ct-checkpoint",
      event_uuid: EVENT_UUID,
      name: "Agility Sprint",
      arena_name: "Main Arena",
      capacity: 40,
      scheduled_start_at: "2026-11-05T09:00:00+07:00",
      scheduled_end_at: "2026-11-05T15:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: OBEDIENCE_UUID,
      competition_type_uuid: "ct-beauty",
      event_uuid: EVENT_UUID,
      name: "Obedience Trial",
      arena_name: "Hall B",
      capacity: 30,
      scheduled_start_at: "2026-11-06T09:00:00+07:00",
      scheduled_end_at: "2026-11-06T14:00:00+07:00",
      registration_closed_at: "2026-10-08T17:00:00+07:00",
      status: "SCHEDULED",
    },
    {
      uuid: "comp-best-in-show-cat",
      competition_type_uuid: "ct-best-in-show",
      event_uuid: "evt-jakarta-cat-show",
      name: "Best in Show - Cat",
      arena_name: "Grand Hall",
      capacity: 60,
      scheduled_start_at: "2026-09-20T10:00:00+07:00",
      scheduled_end_at: "2026-09-20T16:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: "comp-kitten-beauty",
      competition_type_uuid: "ct-beauty",
      event_uuid: "evt-jakarta-cat-show",
      name: "Kitten Beauty Pageant",
      arena_name: "Stage 2",
      capacity: 25,
      scheduled_start_at: "2026-09-21T10:00:00+07:00",
      scheduled_end_at: "2026-09-21T13:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: "comp-paw-race-100m",
      competition_type_uuid: "ct-race",
      event_uuid: "evt-surabaya-paw-race",
      name: "Paw Race 100m",
      arena_name: "Track A",
      capacity: 50,
      scheduled_start_at: "2026-08-15T08:00:00+07:00",
      scheduled_end_at: "2026-08-15T11:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: "comp-paw-race-relay",
      competition_type_uuid: "ct-race",
      event_uuid: "evt-surabaya-paw-race",
      name: "Paw Race Relay",
      arena_name: "Track B",
      capacity: 32,
      scheduled_start_at: "2026-08-15T12:00:00+07:00",
      scheduled_end_at: "2026-08-15T15:00:00+07:00",
      registration_closed_at: "2026-08-01T00:00:00+07:00",
      status: "SCHEDULED",
    },
    {
      uuid: "comp-agility-open",
      competition_type_uuid: "ct-checkpoint",
      event_uuid: "evt-bandung-dog-agility",
      name: "Agility Open Class",
      arena_name: "Outdoor Field",
      capacity: 40,
      scheduled_start_at: "2026-12-10T09:00:00+07:00",
      scheduled_end_at: "2026-12-10T16:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: "comp-exotic-reptile-show",
      competition_type_uuid: "ct-beauty",
      event_uuid: "evt-bali-exotic-pet-expo",
      name: "Exotic Reptile Show",
      arena_name: "Pavilion 1",
      capacity: 20,
      scheduled_start_at: "2026-10-03T10:00:00+08:00",
      scheduled_end_at: "2026-10-03T14:00:00+08:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: "comp-exotic-bird-show",
      competition_type_uuid: "ct-beauty",
      event_uuid: "evt-bali-exotic-pet-expo",
      name: "Exotic Bird Show",
      arena_name: "Pavilion 2",
      capacity: 20,
      scheduled_start_at: "2026-10-04T10:00:00+08:00",
      scheduled_end_at: "2026-10-04T14:00:00+08:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
    {
      uuid: "comp-carnival-costume",
      competition_type_uuid: "ct-beauty",
      event_uuid: "evt-yogya-pet-carnival",
      name: "Pet Costume Parade",
      arena_name: "Main Ground",
      capacity: 100,
      scheduled_start_at: "2026-07-01T09:00:00+07:00",
      scheduled_end_at: "2026-07-01T12:00:00+07:00",
      registration_closed_at: "2026-06-20T00:00:00+07:00",
      status: "SCHEDULED",
    },
    {
      uuid: "comp-medan-obedience",
      competition_type_uuid: "ct-time-trial",
      event_uuid: "evt-medan-pet-championship",
      name: "Obedience Challenge",
      arena_name: "Hall A",
      capacity: 35,
      scheduled_start_at: "2027-01-18T09:00:00+07:00",
      scheduled_end_at: "2027-01-18T15:00:00+07:00",
      registration_closed_at: null,
      status: "SCHEDULED",
    },
  ] as MockCompetition[],

  pets,

  sponsors: [
    {
      uuid: SPONSOR_UUID,
      brand_name: "Whiskas Indonesia",
      email: "partnership@whiskas.example",
      status: "Active",
      pics: [
        { uuid: "pic-1", name: "Sponsor Demo", user_uuid: SPONSOR_USER_UUID },
      ],
    },
    {
      uuid: "spo-royal-canin",
      brand_name: "Royal Canin Indonesia",
      email: "partnership@royalcanin.petpet.dev",
      website_url: "https://royalcanin.example",
      status: "Active",
      pics: [
        { uuid: "pic-2", name: "Wulan Anggraini", user_uuid: "u-sponsor-2" },
      ],
    },
    {
      uuid: "spo-pet-plus-store",
      brand_name: "Pet Plus Store",
      email: "sponsorship@petplus.petpet.dev",
      website_url: "https://petplusstore.example",
      status: "Active",
      pics: [
        { uuid: "pic-3", name: "Agus Prasetyo", user_uuid: "u-sponsor-3" },
      ],
    },
  ] as MockSponsor[],

  eventSponsors: [
    {
      uuid: "evtspo-1",
      event_uuid: EVENT_UUID,
      sponsor_uuid: SPONSOR_UUID,
      sponsorship_level: "GOLD",
      status: "approved" as const,
    },
    {
      uuid: "evtspo-2",
      event_uuid: "evt-jakarta-cat-show",
      sponsor_uuid: "spo-royal-canin",
      sponsorship_level: "PLATINUM",
      status: "approved" as const,
    },
    {
      uuid: "evtspo-3",
      event_uuid: "evt-surabaya-paw-race",
      sponsor_uuid: "spo-pet-plus-store",
      sponsorship_level: "SILVER",
      status: "pending" as const,
    },
  ] as MockEventSponsor[],

  entries: [
    ...seedEntries(BEAUTY_UUID, 21, 75000, "per-beauty-online", [
      ["pet-chibi", CHECKED_IN],
      ["pet-puffy", CHECKED_IN],
      ["pet-sora", CHECKED_IN],
      ["pet-mika", APPROVED],
      ["pet-nana", { ...APPROVED, payment_status: "UNPAID" }],
      ["pet-niko", APPROVED],
      ["pet-kona", CHECKED_IN],
      ["pet-kiwi", APPROVED],
      ["pet-lulu", APPROVED],
      ["pet-momo", CHECKED_IN],
      ["pet-pipi", { ...APPROVED, payment_status: "UNPAID" }],
      ["pet-tofu", APPROVED],
      ["pet-bubu", APPROVED],
      ["pet-dodo", CHECKED_IN],
      ["pet-gigi", PENDING],
      ["pet-hana", { ...PENDING, payment_status: "PAID" }],
      ["pet-yuki", { ...APPROVED, eligibility_status: "REJECTED" }],
      ["pet-ziggy", { ...APPROVED, withdrawn: true }],
      ["pet-ochi", APPROVED],
      ["pet-rara", APPROVED],
      ["pet-suki", CHECKED_IN],
      ["pet-ubi", PENDING],
    ]),
    ...seedEntries(COMPETITION_UUID, 11, 65000, "per-agility-early", [
      [PET_UUID, APPROVED],
      ["pet-rocky", CHECKED_IN],
      ["pet-mochi", { ...APPROVED, payment_status: "UNPAID" }],
      ["pet-oreo", PENDING],
    ]),
    ...seedEntries(OBEDIENCE_UUID, 12, 50000, "per-obedience-online", [
      ["pet-luna", PENDING],
      [PET_UUID, CHECKED_IN],
      ["pet-rocky", APPROVED],
    ]),
    ...seedEntries(MINI_AGILITY_UUID, 13, 0, null, [
      ["pet-chibi", CHECKED_IN],
      ["pet-kona", APPROVED],
      ["pet-momo", APPROVED],
      ["pet-gigi", PENDING],
    ]),
    ...seedEntries(FUN_RUN_UUID, 15, 40000, null, [
      [PET_UUID, CHECKED_IN],
      ["pet-rocky", CHECKED_IN],
      ["pet-mochi", CHECKED_IN],
    ]),
    ...seedEntries(CAT_RELAY_UUID, 16, 0, null, [
      ["pet-simba", APPROVED],
      ["pet-nala", PENDING],
    ]),
    // Other events.
    ...seedEntries("comp-best-in-show-cat", 31, 65000, null, [
      ["pet-milo", CHECKED_IN],
    ]),
    ...seedEntries("comp-kitten-beauty", 32, 65000, null, [
      ["pet-coco", PENDING],
    ]),
    ...seedEntries("comp-paw-race-100m", 41, 65000, null, [
      ["pet-rocky", CHECKED_IN],
      ["pet-mochi", APPROVED],
    ]),
    ...seedEntries("comp-agility-open", 51, 65000, null, [
      ["pet-simba", PENDING],
      ["pet-nala", { ...APPROVED, eligibility_status: "REJECTED" }],
    ]),
    ...seedEntries("comp-carnival-costume", 61, 65000, null, [
      ["pet-oreo", CHECKED_IN],
      ["pet-kiki", CHECKED_IN],
    ]),
  ] as MockEntry[],
  // Master data, mirrors petpet-service competition_types.json / species.json.
  competitionTypes: [
    {
      uuid: "ct-race",
      code: "RACE",
      name: "Race",
      result_mode: "POSITION",
      is_active: true,
    },
    {
      uuid: "ct-time-trial",
      code: "TIME_TRIAL",
      name: "Time Trial",
      result_mode: "TIME",
      is_active: true,
    },
    {
      uuid: "ct-checkpoint",
      code: "CHECKPOINT",
      name: "Checkpoint",
      result_mode: "CHECKPOINT",
      is_active: true,
    },
    {
      uuid: "ct-beauty",
      code: "BEAUTY",
      name: "Beauty / Conformation",
      result_mode: "JUDGED_SCORE",
      is_active: true,
    },
    {
      uuid: "ct-best-in-show",
      code: "BEST_IN_SHOW",
      name: "Best in Show",
      result_mode: "COMBINED",
      is_active: true,
    },
  ],
  species: [
    { uuid: "sp-dog", code: "DOG", name: "Dog" },
    { uuid: "sp-cat", code: "CAT", name: "Cat" },
    { uuid: "sp-sugar-glider", code: "SUGAR_GLIDER", name: "Sugar Glider" },
  ],
  registrationPeriods: [
    {
      uuid: "per-beauty-online",
      competition_uuid: BEAUTY_UUID,
      period_type: "ONLINE",
      price: 75000,
      quota: null,
      registration_start_at: "2026-09-01T00:00:00+07:00",
      registration_end_at: "2026-10-09T23:59:00+07:00",
      status: "ACTIVE",
    },
    {
      uuid: "per-agility-early",
      competition_uuid: COMPETITION_UUID,
      period_type: "EARLY_BIRD",
      price: 65000,
      quota: null,
      registration_start_at: "2026-09-01T00:00:00+07:00",
      registration_end_at: "2026-09-30T23:59:00+07:00",
      status: "ACTIVE",
    },
    {
      uuid: "per-agility-onsite",
      competition_uuid: COMPETITION_UUID,
      period_type: "ON_SITE",
      price: 80000,
      quota: 10,
      registration_start_at: "2026-10-01T00:00:00+07:00",
      registration_end_at: "2026-11-05T12:00:00+07:00",
      status: "ACTIVE",
    },
    {
      uuid: "per-obedience-online",
      competition_uuid: OBEDIENCE_UUID,
      period_type: "ONLINE",
      price: 50000,
      quota: null,
      registration_start_at: "2026-09-01T00:00:00+07:00",
      registration_end_at: "2026-11-05T23:59:00+07:00",
      status: "ACTIVE",
    },
  ] as MockRegistrationPeriod[],
  petMorphs: [
    {
      uuid: "morph-classic-grey",
      species_uuid: "sp-sugar-glider",
      name: "Classic Grey",
    },
    { uuid: "morph-mosaic", species_uuid: "sp-sugar-glider", name: "Mosaic" },
    {
      uuid: "morph-bfbb",
      species_uuid: "sp-sugar-glider",
      name: "Black Face Black Beauty",
    },
    { uuid: "morph-cremino", species_uuid: "sp-sugar-glider", name: "Cremino" },
    { uuid: "morph-caramel", species_uuid: "sp-sugar-glider", name: "Caramel" },
    {
      uuid: "morph-ringtail-mosaic",
      species_uuid: "sp-sugar-glider",
      name: "Ringtail Mosaic",
    },
    {
      uuid: "morph-leucistic",
      species_uuid: "sp-sugar-glider",
      name: "Leucistic",
    },
    {
      uuid: "morph-platinum",
      species_uuid: "sp-sugar-glider",
      name: "Platinum",
    },
    {
      uuid: "morph-border-collie",
      species_uuid: "sp-dog",
      name: "Border Collie",
    },
    {
      uuid: "morph-golden-retriever",
      species_uuid: "sp-dog",
      name: "Golden Retriever",
    },
    { uuid: "morph-shiba-inu", species_uuid: "sp-dog", name: "Shiba Inu" },
    { uuid: "morph-persian", species_uuid: "sp-cat", name: "Persian" },
    {
      uuid: "morph-british-shorthair",
      species_uuid: "sp-cat",
      name: "British Shorthair",
    },
    { uuid: "morph-maine-coon", species_uuid: "sp-cat", name: "Maine Coon" },
  ] as MockPetMorph[],
  scoreCriteria: [] as Record<string, unknown>[],
  organizerApplications: [
    {
      uuid: "app-bekasi-pet-club",
      proposed_organization_name: "Bekasi Pet Club",
      organization_type: "COMMUNITY",
      description: null,
      contact_email: "hello@bekasipet.id",
      contact_phone: null,
      address: null,
      status: "SUBMITTED",
      review_note: null,
      approved_organization_uuid: null,
    },
    {
      uuid: "app-solo-glider",
      proposed_organization_name: "Solo Glider Society",
      organization_type: "COMMUNITY",
      description: null,
      contact_email: "admin@sologlider.id",
      contact_phone: null,
      address: null,
      status: "UNDER_REVIEW",
      review_note: null,
      approved_organization_uuid: null,
    },
  ],
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
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
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
