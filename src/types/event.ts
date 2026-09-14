import type { AuditFields } from "@/types/common";

export type EventStatus = "Pending" | "Open" | "Closed";

export interface EventItem extends AuditFields {
  id: string;
  name: string;
  slogan?: string;
  photo: string;
  startDate: string;
  endDate: string;
  address: string;
  location: string;
  locationUrl?: string;
  organizer: string;
  organizerLogo: string;
  status: EventStatus;
}
