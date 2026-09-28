import type { PortalRecord } from "./portal";

export interface Organization {
  id: string;
  name: string;
  photo: string;
  campaign: string;
  pics: PortalRecord[];
}
export interface OrganizationDraft {
  name: string;
  photo: string;
  campaign: string;
  picIds: string[];
}
