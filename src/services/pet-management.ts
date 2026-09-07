import type { ApiResponse, Paginated } from "@/types/common";
import type { Pet } from "@/types/pet";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockPets } from "@/lib/mocks/pets";
import { delay, ok, paginate } from "@/services/common";

export const petService = {
  list: (): Promise<Paginated<Pet>> =>
    // return apiClient.get<Paginated<Pet>>(ENDPOINTS.pets.list);
    delay(paginate(mockPets)),

  detail: (id: string): Promise<ApiResponse<Pet>> => {
    // return apiClient.get<ApiResponse<Pet>>(ENDPOINTS.pets.detail(id));
    const pet = mockPets.find((p) => p.id === id) ?? mockPets[0];
    return delay(ok(pet));
  },
};
