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

export interface MockOrganizationMember {
  user_uuid: string;
  role: "OWNER" | "ADMIN" | "STAFF";
}

export interface MockOrganization {
  uuid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  members: MockOrganizationMember[];
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
  status: string;
}

export interface MockCompetition {
  uuid: string;
  event_uuid: string;
  name: string;
  description?: string;
  arena_name?: string;
  capacity?: number;
  minimum_judges?: number;
  competition_type_uuid?: string;
  species_uuid?: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  registration_closed_at: string | null;
  status: string;
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

export interface MockSponsorPic {
  uuid: string;
  name: string;
  user_uuid: string;
}

export interface MockSponsor {
  uuid: string;
  brand_name: string;
  phone?: string;
  email?: string;
  website_url?: string;
  status: string;
  pics: MockSponsorPic[];
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

export interface MockEntry {
  uuid: string;
  competition_uuid: string;
  owner_uuid: string;
  pet_uuid?: string;
  team_uuid?: string;
  bib_number?: string;
  registration_fee?: number;
  payment_status: string;
  checkin_status: string;
  status: string;
}
