import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  assignUserRole,
  countUsers,
  createUser,
  deactivateUser,
  getUser,
  listCities,
  listPermissionGroups,
  listProvinces,
  listRoles,
  listUsers,
  revokeUserRole,
  searchUsers,
  updateUser,
} from "./api";
import type { UserFormInput } from "./schema";
import { USER_SEARCH_MIN_LENGTH, type User, type UserListQuery } from "./types";

/** Awalan query key semua data users, supaya satu `invalidateQueries` memuat ulang semuanya. */
export const userKeys = {
  all: ["users"] as const,
  list: (query: UserListQuery) => [...userKeys.all, "list", query] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export function useUsersCount(enabled: boolean) {
  return useQuery({
    queryKey: ["users", "count"],
    queryFn: countUsers,
    enabled,
  });
}

/**
 * Pencarian user untuk dipilih. Baru jalan dari 2 huruf; `q` sebaiknya sudah di-debounce
 * oleh pemanggil supaya tidak menembak server di tiap ketikan.
 */
export function useUserSearch(q: string, organizationId?: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ["users", "search", term, organizationId ?? null],
    queryFn: () => searchUsers(term, organizationId),
    enabled: term.length >= USER_SEARCH_MIN_LENGTH,
    staleTime: 60_000,
  });
}

/** Satu halaman list user dari server. Halaman lama tetap tampil selama halaman baru dimuat. */
export function useUsers(query: UserListQuery) {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: () => listUsers(query),
    placeholderData: keepPreviousData,
  });
}

/** Satu user (halaman detail dan edit). */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => getUser(id),
  });
}

/** Buat user. Setelah berhasil semua list user dimuat ulang. */
export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UserFormInput) => createUser(input),
    onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }),
  });
}

/** Simpan perubahan profil user. */
export function useUpdateUser(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UserFormInput) => updateUser(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }),
  });
}

/** Nonaktifkan user (backend: status SUSPENDED). */
export function useDeactivateUser(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deactivateUser(id),
    onSuccess: () => client.invalidateQueries({ queryKey: userKeys.all }),
  });
}

/**
 * Beri satu role. Respons backend sudah berisi user dengan role terbaru, jadi detail
 * langsung diperbarui tanpa menunggu muat ulang; list ditandai basi.
 */
export function useAssignRole(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (role: string) => assignUserRole(id, role),
    onSuccess: (user: User) => {
      client.setQueryData(userKeys.detail(id), user);
      return client.invalidateQueries({ queryKey: [...userKeys.all, "list"] });
    },
  });
}

/** Cabut satu role (kode role). Pola sama dengan `useAssignRole`. */
export function useRevokeRole(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => revokeUserRole(id, code),
    onSuccess: (user: User) => {
      client.setQueryData(userKeys.detail(id), user);
      return client.invalidateQueries({ queryKey: [...userKeys.all, "list"] });
    },
  });
}

/** Semua role platform (`GET /auth/roles`): kartu role, matriks, dan kotak role di form. */
export function useRoles() {
  return useQuery({
    queryKey: ["roles", "list"],
    queryFn: listRoles,
    staleTime: 5 * 60_000,
  });
}

/** Semua permission per modul (`GET /auth/permissions`, butuh `user.view`). */
export function usePermissionGroups() {
  return useQuery({
    queryKey: ["roles", "permissions"],
    queryFn: listPermissionGroups,
    staleTime: 5 * 60_000,
  });
}

/** Provinsi Indonesia untuk select di form. Jarang berubah, jadi di-cache lama. */
export function useProvinces() {
  return useQuery({
    queryKey: ["regions", "provinces"],
    queryFn: listProvinces,
    staleTime: Infinity,
  });
}

/** Kota/kabupaten satu provinsi. Baru jalan setelah provinsi dipilih (`provinceId` ada). */
export function useCities(provinceId: string | undefined) {
  return useQuery({
    queryKey: ["regions", "cities", provinceId],
    queryFn: () => listCities(provinceId as string),
    enabled: Boolean(provinceId),
    staleTime: Infinity,
  });
}
