import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "./common";
import type {
  ListParams,
  ListResponse,
  RecordResponse,
  MutationResponse,
  PetPayload,
} from "@/types/api";
export const PET_SERVICES = {
  list: (params?: ListParams) =>
    apiClient.get<ListResponse>(buildUrl(ENDPOINTS.pets.list, params)),
  detail: (id: string) =>
    apiClient.get<RecordResponse>(ENDPOINTS.pets.detail(id)),
  create: (payload: PetPayload) =>
    apiClient.post<RecordResponse>(ENDPOINTS.pets.list, { ...payload }),
  update: (
    id: string,
    payload: Partial<Omit<PetPayload, "species_id" | "morph_id">>,
  ) =>
    apiClient.patch<RecordResponse>(ENDPOINTS.pets.detail(id), { ...payload }),
  delete: (id: string) =>
    apiClient.delete<MutationResponse>(ENDPOINTS.pets.detail(id)),
};
