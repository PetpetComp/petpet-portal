import type {
  CompetitionStatus,
  RegistrationPeriodType,
} from "@/domains/competitions/types";
import type { EventStatus } from "@/domains/events/types";
import type {
  CheckinStatus,
  EligibilityStatus,
  EntryStatus,
  PaymentStatus,
} from "@/domains/entries/types";

export interface MockUser {
  uuid: string;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  status: string;
}

export interface MockPic {
  uuid: string;
  name: string;
  user_uuid: string;
}

export interface MockOrganization {
  uuid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  pics: MockPic[];
}

export interface MockEvent {
  uuid: string;
  organization_uuid: string;
  name: string;
  tagline?: string;
  description?: string;
  venue_name?: string;
  venue_address?: string;
  map_location?: string;
  timezone?: string;
  start_at: string;
  end_at: string;
  /** Nilai backend: DRAFT, PUBLISHED, CANCELLED. Fase (Event day, Upcoming, ...) dihitung di mock-events.ts. */
  status: EventStatus;
}

export interface MockCompetition {
  uuid: string;
  event_uuid: string;
  name: string;
  description?: string;
  arena_name?: string;
  capacity?: number;
  minimum_judges?: number;
  competition_type_uuid: string;
  species_uuid?: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  registration_closed_at: string | null;
  /** `registration_open`, its reason and `actions` are computed (mock-rules.ts), never stored. */
  status: CompetitionStatus;
}

/** Same columns as petpet-service `registration_periods`. */
export interface MockRegistrationPeriod {
  uuid: string;
  competition_uuid: string;
  period_type: RegistrationPeriodType;
  price: number;
  quota: number | null;
  registration_start_at: string;
  registration_end_at: string;
  status: "ACTIVE" | "CLOSED";
}

export interface MockPetMorph {
  uuid: string;
  species_uuid: string;
  name: string;
}

export interface MockPet {
  uuid: string;
  owner_uuid: string;
  name: string;
  species_uuid?: string;
  morph_uuid?: string;
  registration_number?: string;
  gender?: string;
  birth_date?: string;
  height_cm?: number;
  weight_grams?: number;
  status: string;
}

export interface MockSponsor {
  uuid: string;
  brand_name: string;
  phone?: string;
  email?: string;
  website_url?: string;
  status: string;
  pics: MockPic[];
}

export interface MockEventSponsor {
  uuid: string;
  event_uuid: string;
  sponsor_uuid: string;
  sponsorship_level: string;
  campaign_text?: string;
  display_order?: number;
  start_at?: string;
  end_at?: string;
  status: "pending" | "approved" | "rejected";
}

/** Stored columns only; names and `actions` are added when serialized (mock-records.ts). */
export interface MockEntry {
  uuid: string;
  participant_code: string | null;
  competition_uuid: string;
  owner_uuid: string;
  pet_uuid: string | null;
  team_uuid: string | null;
  registration_period_uuid: string | null;
  bib_number: string | null;
  registration_fee: number;
  eligibility_status: EligibilityStatus;
  payment_status: PaymentStatus;
  checkin_status: CheckinStatus;
  status: EntryStatus;
  registered_at: string;
  checked_in_at: string | null;
  registered_by_uuid: string;
}
