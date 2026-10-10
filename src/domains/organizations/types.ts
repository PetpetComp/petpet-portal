/** One organization exactly as the API sends it (petpet-service `OrganizationData::toArray`). */
export type ApiOrganization = {
  uuid: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  sponsor_uuid: string | null;
};

/** Backend values of `organizer_applications.status`. */
export const ORGANIZER_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type OrganizerApplicationStatus =
  (typeof ORGANIZER_APPLICATION_STATUSES)[number];

/** Organisasi seperti dipakai layar (pemilih organizer, filter list event). Dibuat oleh `fromApi`. */
export type Organization = {
  id: string;
  name: string;
};

/** Mengubah satu baris API menjadi bentuk layar. Dipanggil dari `listOrganizations`. */
export function fromApi(row: ApiOrganization): Organization {
  return { id: row.uuid, name: row.name };
}
