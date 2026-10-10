import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { buildUrl, collectRows } from "@/services/common";
import type { ListResponse, MutationResponse } from "@/types/api";
import type { ApiResponse } from "@/types/common";
import {
  brandFromApi,
  linkFromApi,
  type ApiEventSponsor,
  type ApiSponsor,
  type Brand,
  type EventSponsorLink,
} from "./types";

/**
 * Semua tautan sponsor satu event. Backend mengembalikan array datar,
 * `collectRows` menerima array datar maupun `{ items, meta }` (kontrak 13 bagian 4).
 */
export async function listEventSponsorLinks(
  eventId: string,
): Promise<EventSponsorLink[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiEventSponsor>>(
      buildUrl(ENDPOINTS.events.sponsors(eventId), page),
    ),
  );
  return rows.map(linkFromApi);
}

/** Semua brand (semua halaman), dipakai untuk nama brand dan pilihan di drawer Add sponsor. */
export async function listBrands(): Promise<Brand[]> {
  const rows = await collectRows((page) =>
    apiClient.get<ListResponse<ApiSponsor>>(
      buildUrl(ENDPOINTS.sponsors.list, page),
    ),
  );
  return rows.map(brandFromApi);
}

/** `POST /events/{uuid}/sponsors`: menautkan satu brand ke event dengan satu tier. */
export async function addEventSponsor(
  eventId: string,
  brandId: string,
  level: string,
): Promise<EventSponsorLink> {
  const response = await apiClient.post<ApiResponse<ApiEventSponsor>>(
    ENDPOINTS.events.sponsors(eventId),
    { sponsor_id: brandId, sponsorship_level: level },
  );
  return linkFromApi(response.data);
}

/** `DELETE /events/{uuid}/sponsors/{linkUuid}`: melepas brand dari event. */
export async function removeEventSponsor(
  eventId: string,
  linkId: string,
): Promise<void> {
  await apiClient.delete<MutationResponse>(
    ENDPOINTS.events.sponsor(eventId, linkId),
  );
}

/**
 * Mengubah tier satu sponsor. Backend belum punya PATCH, jadi caranya: hapus tautan lama,
 * lalu buat tautan baru dengan tier baru (dua langkah, tidak atomik).
 * Bila pembuatan gagal setelah penghapusan berhasil, tautan lama dibuat ulang supaya sponsor
 * tidak hilang dari event, lalu galat aslinya dilempar ke pemanggil.
 * Dipanggil dari `useChangeSponsorLevel`. Saat backend punya PATCH, hanya fungsi ini yang berubah.
 */
export async function changeEventSponsorLevel(
  eventId: string,
  link: { id: string; brandId: string; level: string },
  newLevel: string,
): Promise<EventSponsorLink> {
  await removeEventSponsor(eventId, link.id);
  try {
    return await addEventSponsor(eventId, link.brandId, newLevel);
  } catch (cause) {
    try {
      await addEventSponsor(eventId, link.brandId, link.level);
    } catch {
      // Pemulihan gagal juga: galat asli tetap yang paling berguna untuk pengguna.
    }
    throw cause;
  }
}
