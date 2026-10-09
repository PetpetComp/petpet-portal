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
