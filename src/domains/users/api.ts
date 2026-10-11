import { apiClient } from "@/lib/api-client";
import { ENDPOINTS } from "@/lib/constants/endpoints";
import { countAt } from "@/lib/api-count";
import { buildUrl, fetchPageRows } from "@/services/common";
import type { ListResponse, MutationResponse } from "@/types/api";
import type { ApiResponse } from "@/types/common";
import {
  hasProfileInput,
  toCreateBody,
  toProfileBody,
  toUpdateBody,
  type UserFormInput,
} from "./schema";
import { sortPermissionGroups } from "./roles";
import {
  COUNTRY_CODE,
  USER_SEARCH_LIMIT,
  permissionGroupsFromApi,
  roleFromApi,
  userFromApi,
  userHitFromApi,
  userListParams,
  userPageFromApi,
  type ApiCity,
  type ApiCountry,
  type ApiPermissionsByModule,
  type ApiProvince,
  type ApiRoleList,
  type ApiUser,
  type ApiUserList,
  type ApiUserSummary,
  type PermissionGroup,
  type RegionOption,
  type Role,
  type User,
  type UserListQuery,
  type UserPage,
  type UserSearchResult,
} from "./types";

export const countUsers = () => countAt(ENDPOINTS.users.list);

/**
 * Cari user lewat `GET /users?q=` (maksimal 5 hasil).
 * `organizationId` meminta server mengurutkan anggota organisasi itu lebih dulu dan
 * menandainya (`is_member`). Dipanggil dari `useUserSearch`.
 */
export async function searchUsers(
  q: string,
  organizationId?: string,
): Promise<UserSearchResult> {
  const { items, total } = await fetchPageRows(
    (page) =>
      apiClient.get<ListResponse<ApiUserSummary>>(
        buildUrl(ENDPOINTS.users.list, {
          q,
          organization_id: organizationId,
          ...page,
        }),
      ),
    { page: 1, per_page: USER_SEARCH_LIMIT },
  );
  return { items: items.map(userHitFromApi), total };
}

/** Satu halaman list user, difilter/diurutkan server (kontrak users bagian 1). Dipanggil dari `useUsers`. */
export async function listUsers(query: UserListQuery): Promise<UserPage> {
  const response = await apiClient.get<ApiResponse<ApiUserList>>(
    buildUrl(ENDPOINTS.users.list, userListParams(query)),
  );
  return userPageFromApi(response.data);
}

/** `GET /users/{uuid}`. Dipanggil dari `useUser` (halaman detail dan edit). */
export async function getUser(id: string): Promise<User> {
  const response = await apiClient.get<ApiResponse<ApiUser>>(
    ENDPOINTS.users.detail(id),
  );
  return userFromApi(response.data);
}

/** Hasil membuat user: user baru, plus pesan bila profilnya gagal disimpan di langkah kedua. */
export type CreateUserOutcome = { user: User; profileError: string | null };

/**
 * Membuat user. Backend `POST /users` baru menerima username, email, nama, telepon, status,
 * dan roles; gender, provinsi, dan kota hanya bisa lewat `PATCH`. Jadi bila ada isian
 * profil, dikirim lewat `PATCH` tepat setelah user terbuat (dua request, doc 09).
 * Bila langkah kedua gagal, user TIDAK dibatalkan: `profileError` memberi tahu layar.
 */
export async function createUser(
  input: UserFormInput,
): Promise<CreateUserOutcome> {
  const created = await apiClient.post<ApiResponse<ApiUser>>(
    ENDPOINTS.users.list,
    toCreateBody(input),
  );
  if (!hasProfileInput(input))
    return { user: userFromApi(created.data), profileError: null };
  try {
    const patched = await apiClient.patch<ApiResponse<ApiUser>>(
      ENDPOINTS.users.detail(created.data.uuid),
      toProfileBody(input),
    );
    return { user: userFromApi(patched.data), profileError: null };
  } catch (cause) {
    return {
      user: userFromApi(created.data),
      profileError:
        cause instanceof Error
          ? cause.message
          : "Unable to save the address details.",
    };
  }
}

/** `PATCH /users/{uuid}`: nama, telepon, gender, provinsi, kota. */
export async function updateUser(
  id: string,
  input: UserFormInput,
): Promise<User> {
  const response = await apiClient.patch<ApiResponse<ApiUser>>(
    ENDPOINTS.users.detail(id),
    toUpdateBody(input),
  );
  return userFromApi(response.data);
}

/** `DELETE /users/{uuid}`: di backend artinya menonaktifkan (status SUSPENDED), bukan menghapus. */
export const deactivateUser = (id: string) =>
  apiClient.delete<MutationResponse>(ENDPOINTS.users.detail(id));

/** `POST /users/{uuid}/roles`: memberi satu role. Mengembalikan user dengan daftar role terbaru. */
export async function assignUserRole(id: string, role: string): Promise<User> {
  const response = await apiClient.post<ApiResponse<ApiUser>>(
    ENDPOINTS.users.roles(id),
    { role },
  );
  return userFromApi(response.data);
}

/** `DELETE /users/{uuid}/roles/{code}`: mencabut satu role. Mengembalikan user terbaru. */
export async function revokeUserRole(id: string, code: string): Promise<User> {
  const response = await apiClient.delete<ApiResponse<ApiUser>>(
    ENDPOINTS.users.role(id, code),
  );
  return userFromApi(response.data);
}

/** `GET /auth/roles` (terbuka untuk semua yang login). Dipanggil dari `useRoles`. */
export async function listRoles(): Promise<Role[]> {
  const response = await apiClient.get<ApiResponse<ApiRoleList>>(
    ENDPOINTS.auth.roles,
  );
  return response.data.items.map(roleFromApi);
}

/** `GET /auth/permissions` (butuh `user.view`): permission dikelompokkan per modul. */
export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  const response = await apiClient.get<ApiResponse<ApiPermissionsByModule>>(
    ENDPOINTS.auth.permissions,
  );
  return sortPermissionGroups(permissionGroupsFromApi(response.data));
}

/**
 * Daftar provinsi Indonesia untuk form. Backend meminta `country_id`, jadi negara dicari
 * dulu dari `GET /master/countries` lewat kodenya. Mengembalikan daftar kosong bila
 * negara itu tidak ada di master (form lalu jatuh ke isian teks).
 */
export async function listProvinces(): Promise<RegionOption[]> {
  const countries = await apiClient.get<ApiResponse<ApiCountry[]>>(
    ENDPOINTS.master.countries,
  );
  const country = countries.data.find((c) => c.code === COUNTRY_CODE);
  if (!country) return [];
  const provinces = await apiClient.get<ApiResponse<ApiProvince[]>>(
    buildUrl(ENDPOINTS.master.provinces, { country_id: country.uuid }),
  );
  return provinces.data.map((p) => ({ id: p.uuid, name: p.name }));
}

/** Kota/kabupaten satu provinsi dari `GET /master/cities?province_id=`. */
export async function listCities(provinceId: string): Promise<RegionOption[]> {
  const cities = await apiClient.get<ApiResponse<ApiCity[]>>(
    buildUrl(ENDPOINTS.master.cities, { province_id: provinceId }),
  );
  return cities.data.map((c) => ({ id: c.uuid, name: c.name }));
}
