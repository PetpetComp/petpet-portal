import { useMemo } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createPet,
  deletePet,
  getPet,
  listPetMorphs,
  listPets,
  listSpecies,
  updatePet,
} from "./api";
import { withMasterNames, type ApiPetBody, type PetListQuery } from "./types";

export const petKeys = {
  all: ["pets"] as const,
  list: (query: PetListQuery) => [...petKeys.all, "list", query] as const,
  detail: (id: string) => [...petKeys.all, "detail", id] as const,
  species: ["pets", "master", "species"] as const,
  morphs: ["pets", "master", "morphs"] as const,
};

/** Data master berubah jarang: boleh dipakai dari cache selama 5 menit. */
const MASTER_STALE_MS = 5 * 60_000;

/** Daftar spesies dari master. Sumber chip filter dan pilihan spesies di form. */
export function useSpecies() {
  return useQuery({
    queryKey: petKeys.species,
    queryFn: listSpecies,
    staleTime: MASTER_STALE_MS,
  });
}

/** Semua morph dari master. Disaring per spesies lewat `morphsForSpecies`. */
export function usePetMorphs() {
  return useQuery({
    queryKey: petKeys.morphs,
    queryFn: listPetMorphs,
    staleTime: MASTER_STALE_MS,
  });
}

/**
 * Satu halaman list pet dari server, dengan nama spesies dan morph terisi dari master
 * bila API tidak mengirimnya. Halaman lama tetap tampil selama halaman baru dimuat.
 * Master yang gagal dimuat tidak menggagalkan list: nama saja yang kosong.
 */
export function usePetList(query: PetListQuery) {
  const result = useQuery({
    queryKey: petKeys.list(query),
    queryFn: () => listPets(query),
    placeholderData: keepPreviousData,
  });
  const species = useSpecies().data;
  const morphs = usePetMorphs().data;
  const page = useMemo(
    () =>
      result.data && {
        meta: result.data.meta,
        items: result.data.items.map((pet) =>
          withMasterNames(pet, species ?? [], morphs ?? []),
        ),
      },
    [result.data, species, morphs],
  );
  return {
    page,
    isPending: result.isPending,
    isPlaceholderData: result.isPlaceholderData,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Satu pet (detail dan form Edit), dengan nama spesies dan morph terisi dari master. */
export function usePet(id: string) {
  const result = useQuery({
    queryKey: petKeys.detail(id),
    queryFn: () => getPet(id),
  });
  const species = useSpecies().data;
  const morphs = usePetMorphs().data;
  const pet = useMemo(
    () =>
      result.data && withMasterNames(result.data, species ?? [], morphs ?? []),
    [result.data, species, morphs],
  );
  return {
    pet,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Muat ulang semua list/detail pet dan pencarian pemilik di tab Registrations
 * (drawer Register pet membaca pet milik pemilik). Dipanggil setelah create/update/delete.
 */
function useInvalidatePets() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: petKeys.all });
    await client.invalidateQueries({ queryKey: ["owner-search"] });
  };
}

/** Buat pet baru. */
export function useCreatePet() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: (body: ApiPetBody) => createPet(body),
    onSuccess: invalidate,
  });
}

/** Simpan perubahan satu pet. */
export function useUpdatePet(id: string) {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: (body: ApiPetBody) => updatePet(id, body),
    onSuccess: invalidate,
  });
}

/**
 * Hapus satu pet. Cache detail pet itu dibuang (bukan dimuat ulang) karena request-nya
 * akan 404 selagi halaman detail masih terbuka; yang dimuat ulang hanya list dan pencarian pemilik.
 */
export function useDeletePet(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => deletePet(id),
    onSuccess: async () => {
      client.removeQueries({ queryKey: petKeys.detail(id) });
      await client.invalidateQueries({ queryKey: [...petKeys.all, "list"] });
      await client.invalidateQueries({ queryKey: ["owner-search"] });
    },
  });
}
