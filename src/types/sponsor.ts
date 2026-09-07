import type { AuditFields } from "@/types/common";

export type SponsorCategory =
  "Platinum" | "Gold" | "Silver" | "Bronze" | "Media Partner";

export interface SponsorAssignment {
  id: string;
  eventId: string;
  category: SponsorCategory;
}

export interface SponsorBrand extends AuditFields {
  id: string;
  name: string;
  logo: string;
  phone: string;
  campaign: string;
  instagramId: string;
  tiktokId: string;
  facebookId: string;
  youtubeId: string;
  threadsId: string;
  xId: string;
  picUserIds: string[];
  assignments: SponsorAssignment[];
}
