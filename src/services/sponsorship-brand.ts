import type { ApiResponse, Paginated } from "@/types/common";
import type { SponsorBrand } from "@/types/sponsor";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { mockSponsors } from "@/lib/mocks/sponsors";
import { delay, ok, paginate } from "@/services/common";

export const sponsorService = {
  list: (): Promise<Paginated<SponsorBrand>> =>
    // return apiClient.get<Paginated<SponsorBrand>>(ENDPOINTS.sponsors.list);
    delay(paginate(mockSponsors)),

  detail: (id: string): Promise<ApiResponse<SponsorBrand>> => {
    // return apiClient.get<ApiResponse<SponsorBrand>>(ENDPOINTS.sponsors.detail(id));
    const brand = mockSponsors.find((b) => b.id === id) ?? mockSponsors[0];
    return delay(ok(brand));
  },
};
