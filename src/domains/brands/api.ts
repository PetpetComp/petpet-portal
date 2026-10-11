import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl } from "@/services/common";
import type { MutationResponse } from "@/types/api";
import type { ApiResponse } from "@/types/common";
import { brandToBody, type BrandDetails } from "./schema";
import {
  brandListParams,
  brandPageFromApi,
  fromApi,
  type ApiBrand,
  type ApiBrandList,
  type Brand,
  type BrandListQuery,
  type BrandPage,
} from "./types";

/**
 * Satu halaman brand dari `GET /sponsors`. Backend hanya mengirim brand ACTIVE, diurutkan
 * nama; `q` baru didukung mock (kontrak draf brands). Dipanggil dari `useBrandPage`.
 */
export async function listBrandPage(query: BrandListQuery): Promise<BrandPage> {
  const response = await apiClient.get<ApiResponse<ApiBrandList>>(
    buildUrl(ENDPOINTS.sponsors.list, brandListParams(query)),
  );
  return brandPageFromApi(response.data);
}

/** `GET /sponsors/{uuid}`: detail satu brand (termasuk `pics`). Brand INACTIVE tetap bisa dibuka. */
export async function getBrand(id: string): Promise<Brand> {
  const response = await apiClient.get<ApiResponse<ApiBrand>>(
    ENDPOINTS.sponsors.detail(id),
  );
  return fromApi(response.data);
}

/** `POST /sponsors`: membuat brand baru (status ACTIVE ditetapkan backend). */
export async function createBrand(details: BrandDetails): Promise<Brand> {
  const response = await apiClient.post<ApiResponse<ApiBrand>>(
    ENDPOINTS.sponsors.list,
    brandToBody(details),
  );
  return fromApi(response.data);
}

/** `PATCH /sponsors/{uuid}`: mengirim seluruh isi form Edit. */
export async function updateBrand(
  id: string,
  details: BrandDetails,
): Promise<Brand> {
  const response = await apiClient.patch<ApiResponse<ApiBrand>>(
    ENDPOINTS.sponsors.detail(id),
    brandToBody(details),
  );
  return fromApi(response.data);
}

/**
 * `DELETE /sponsors/{uuid}`: di backend artinya menonaktifkan (status INACTIVE), bukan
 * menghapus baris. Brand hilang dari daftar. 422 bila sudah nonaktif.
 */
export async function deactivateBrand(id: string): Promise<Brand> {
  const response = await apiClient.delete<ApiResponse<ApiBrand>>(
    ENDPOINTS.sponsors.detail(id),
  );
  return fromApi(response.data);
}

/** `POST /sponsors/{uuid}/pics`: menjadikan satu user PIC brand. Response backend `data: null`. */
export async function addBrandPic(
  brandId: string,
  userId: string,
): Promise<void> {
  await apiClient.post<MutationResponse>(ENDPOINTS.sponsors.pics(brandId), {
    user_id: userId,
  });
}

/** `DELETE /sponsors/{uuid}/pics/{userUuid}`: melepas satu PIC. Backend 200 walau user bukan PIC. */
export async function removeBrandPic(
  brandId: string,
  userId: string,
): Promise<void> {
  await apiClient.delete<MutationResponse>(
    ENDPOINTS.sponsors.pic(brandId, userId),
  );
}
