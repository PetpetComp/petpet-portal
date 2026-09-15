import type { ApiResponse } from "./common";
export interface ApiRecord extends Record<string, unknown> {
  uuid: string;
}
export interface ListParams {
  page?: number;
  per_page?: number;
}
export type ListResponse<T extends Record<string, unknown> = ApiRecord> =
  ApiResponse<
    | T[]
    | {
        items: T[];
        meta?: {
          current_page?: number;
          per_page?: number;
          total?: number;
          last_page?: number;
        };
      }
  >;
export type RecordResponse<T extends ApiRecord = ApiRecord> = ApiResponse<T>;
export type MutationResponse = ApiResponse<null>;

export interface UserRecord extends ApiRecord {
  username: string;
  email: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  status: string;
  profile?: Record<string, string | null>;
  roles?: { uuid?: string; code: string; name: string }[];
  permissions?: string[];
}
export type UserPayload = {
  username: string;
  email: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  status?: string;
  roles?: string[];
};
export type UserUpdatePayload = Partial<
  Omit<UserPayload, "username" | "email" | "roles">
> & {
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  nation?: string | null;
};
export type EventPayload = {
  name: string;
  start_at: string;
  end_at: string;
  organization_id?: string;
  new_organization?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  tagline?: string | null;
  description?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  map_location?: string | null;
  timezone?: string;
};
export type PetPayload = {
  species_id: string;
  name: string;
  morph_id?: string;
  registration_number?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  height_cm?: number | null;
  weight_grams?: number | null;
};
export type SponsorPayload = {
  brand_name: string;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
};
export type CompetitionPayload = {
  competition_type_id: string;
  name: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  species_id?: string;
  description?: string | null;
  arena_name?: string | null;
  capacity?: number | null;
  minimum_judges?: number | null;
};
export type EntryPayload = {
  pet_id?: string;
  team_id?: string;
  registration_period_id?: string;
};
export type SponsorAssignmentPayload = {
  sponsor_id: string;
  sponsorship_level: string;
  campaign_text?: string | null;
  display_order?: number;
  start_at?: string | null;
  end_at?: string | null;
};
export type StaffInvitationPayload = {
  event_id: string;
  email: string;
  assignment_role: string;
  competition_id?: string;
};
export type RulePayload = {
  ranking_rule: string[];
  tie_break_rule?: string[];
  countdown_enabled?: boolean;
  countdown_seconds?: number;
  concurrent_participant_limit?: number;
  time_limit_ms?: number;
  attempt_limit?: number;
  checkpoint_total?: number;
  lane_total?: number;
  qualifier_limit?: number;
  best_result_method?: string;
  timeout_result?: string;
};
export type PeriodPayload = {
  period_type: string;
  price: number;
  quota?: number;
  registration_start_at: string;
  registration_end_at: string;
};
export type CriterionPayload = {
  code: string;
  name: string;
  weight: number;
  min_score: number;
  max_score: number;
  description?: string;
  note_required?: boolean;
  display_order?: number;
};
