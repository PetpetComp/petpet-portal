import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sponsorKeys } from "@/domains/sponsors/queries";
import {
  addBrandPic,
  createBrand,
  deactivateBrand,
  getBrand,
  listBrandPage,
  removeBrandPic,
  updateBrand,
} from "./api";
import type { BrandDetails } from "./schema";
import type { BrandListQuery } from "./types";

export const brandKeys = {
  all: ["brands"] as const,
  list: (query: BrandListQuery) => [...brandKeys.all, "list", query] as const,
  detail: (id: string) => [...brandKeys.all, "detail", id] as const,
};

/** Satu halaman daftar brand dari server. Halaman lama tetap tampil selama halaman baru dimuat. */
export function useBrandPage(query: BrandListQuery) {
  return useQuery({
    queryKey: brandKeys.list(query),
    queryFn: () => listBrandPage(query),
    placeholderData: keepPreviousData,
  });
}

/** Detail satu brand, termasuk daftar PIC. */
export function useBrand(id: string) {
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: () => getBrand(id),
  });
}

/**
 * Memuat ulang semua data brand setelah ada perubahan: daftar, detail, dan daftar brand milik
 * tab Sponsors di event (`sponsorKeys.brands`), supaya nama brand di sana ikut segar.
 */
function useRefreshBrands() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: brandKeys.all }),
      client.invalidateQueries({ queryKey: sponsorKeys.brands() }),
    ]);
}

/** Buat brand baru. */
export function useCreateBrand() {
  const refresh = useRefreshBrands();
  return useMutation({
    mutationFn: (details: BrandDetails) => createBrand(details),
    onSuccess: refresh,
  });
}

/** Simpan perubahan Edit brand. */
export function useUpdateBrand(id: string) {
  const refresh = useRefreshBrands();
  return useMutation({
    mutationFn: (details: BrandDetails) => updateBrand(id, details),
    onSuccess: refresh,
  });
}

/** Hapus brand (di backend: dinonaktifkan). */
export function useDeleteBrand(id: string) {
  const refresh = useRefreshBrands();
  return useMutation({
    mutationFn: () => deactivateBrand(id),
    onSuccess: refresh,
  });
}

/** Tambah satu user sebagai PIC brand. */
export function useAddBrandPic(brandId: string) {
  const refresh = useRefreshBrands();
  return useMutation({
    mutationFn: (userId: string) => addBrandPic(brandId, userId),
    onSuccess: refresh,
  });
}

/** Lepas satu PIC dari brand. Daftar dimuat ulang apa pun hasilnya. */
export function useRemoveBrandPic(brandId: string) {
  const refresh = useRefreshBrands();
  return useMutation({
    mutationFn: (userId: string) => removeBrandPic(brandId, userId),
    onSettled: refresh,
  });
}
