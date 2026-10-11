import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "@/services/common";
import type { MutationResponse } from "@/types/api";
import type { ApiResponse } from "@/types/common";
import {
  fromApi,
  morphFromApi,
  petListParams,
  petPageFromApi,
  speciesFromApi,
  type ApiPet,
  type ApiPetBody,
  type ApiPetList,
  type ApiPetMorph,
  type ApiSpecies,
  type Pet,
  type PetListQuery,
  type PetMorph,
  type PetPage,
  type Species,
} from "./types";

/**
 * Satu halaman pet. Filter, urutan, dan paging dikirim ke server (kontrak pets).
 * Backend asli membalas array datar berisi pet pemanggil saja; `petPageFromApi`
 * memotongnya per halaman. Dipanggil dari `usePetList`.
 */
export async function listPets(query: PetListQuery): Promise<PetPage> {
  const response = await apiClient.get<ApiResponse<ApiPetList | ApiPet[]>>(
    buildUrl(ENDPOINTS.pets.list, petListParams(query)),
  );
  return petPageFromApi(response.data, query);
}

/** `GET /pets/{uuid}`. 403 bila pemanggil bukan pemilik (aturan backend), 404 bila tidak ada. */
export async function getPet(id: string): Promise<Pet> {
  const response = await apiClient.get<ApiResponse<ApiPet>>(
    ENDPOINTS.pets.detail(id),
  );
  return fromApi(response.data);
}

/** `POST /pets`. 422 membawa pesan per field di `ApiError.errors`. */
export async function createPet(body: ApiPetBody): Promise<Pet> {
  const response = await apiClient.post<ApiResponse<ApiPet>>(
    ENDPOINTS.pets.list,
    body,
  );
  return fromApi(response.data);
}

/** `PATCH /pets/{uuid}`: mengirim seluruh isi form Edit. */
export async function updatePet(id: string, body: ApiPetBody): Promise<Pet> {
  const response = await apiClient.patch<ApiResponse<ApiPet>>(
    ENDPOINTS.pets.detail(id),
    body,
  );
  return fromApi(response.data);
}

/** `DELETE /pets/{uuid}`. 422 bila pet sudah punya entry kompetisi. */
export async function deletePet(id: string): Promise<void> {
  await apiClient.delete<MutationResponse>(ENDPOINTS.pets.detail(id));
}

/** `GET /master/species`: array datar (data master tidak dipaging). Sumber chip dan pilihan spesies. */
export async function listSpecies(): Promise<Species[]> {
  const response = await apiClient.get<ApiResponse<ApiSpecies[]>>(
    ENDPOINTS.master.species,
  );
  return response.data.map(speciesFromApi);
}

/** `GET /master/pet-morphs`: semua morph aktif, array datar. Disaring per spesies di layar. */
export async function listPetMorphs(): Promise<PetMorph[]> {
  const response = await apiClient.get<ApiResponse<ApiPetMorph[]>>(
    ENDPOINTS.master.petMorphs,
  );
  return response.data.map(morphFromApi);
}
