import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type { ListParams, ListResponse, ApiRecord } from "@/types/api";
export interface MasterRow extends ApiRecord {
  code?: string;
  name: string;
  type?: string;
  postal_code?: string;
}
export const MASTER_SERVICES = {
  species: (params?: ListParams) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.species, params),
    ),
  petMorphs: (params?: ListParams & { species_id?: string }) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.petMorphs, params),
    ),
  competitionTypes: (params?: ListParams) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.competitionTypes, params),
    ),
  countries: (params?: ListParams) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.countries, params),
    ),
  provinces: (params?: ListParams & { country_id?: string }) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.provinces, params),
    ),
  cities: (params?: ListParams & { province_id?: string }) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.cities, params),
    ),
  districts: (params?: ListParams & { city_id?: string }) =>
    apiClient.get<ListResponse<MasterRow>>(
      buildUrl(ENDPOINTS.master.districts, params),
    ),
};
