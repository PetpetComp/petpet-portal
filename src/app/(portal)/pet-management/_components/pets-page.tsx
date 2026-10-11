"use client";
import { useState } from "react";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FilterSheet } from "@/components/common/filter-sheet";
import { ListPageHeader } from "@/components/common/list-page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { petFeatures } from "@/domains/pets/features";
import {
  INITIAL_LIST_STATE,
  PER_PAGE_OPTIONS,
  buildPetListQuery,
  hasActiveFilters,
  type PetListState,
} from "@/domains/pets/list-state";
import { usePetList, useSpecies } from "@/domains/pets/queries";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PERMISSION } from "@/lib/auth/permissions";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { PetListHeader, PetRow } from "./pet-card";

/**
 * Halaman list pet (`/pet-management`): judul + "New pet", pencarian + tombol Filter,
 * daftar berkolom (kartu di HP), dan pagination.
 *
 * Spesies dipilih di panel Filter (slide dari kanan) memakai pola DRAFT: panel mengedit
 * `draftSpeciesId`; saat dibuka draft disalin dari filter berlaku, "Apply" menyalinnya ke
 * `state.speciesId` (halaman kembali ke 1), "Reset" mengosongkan keduanya. Pilihan spesies diambil
 * dari `GET /master/species` (temuan D11: desain menulis Dog/Cat tetap, padahal master hanya
 * berisi Sugar Glider). Di mode backend asli pencarian dan filter disembunyikan karena
 * `GET /pets` belum mendukungnya (`petFeatures`); paging tetap jalan (dipotong di klien).
 * Dipanggil dari `pet-management/page.tsx`.
 */
export function PetsPage() {
  const { can } = useAuth();
  const features = petFeatures(USING_MOCK_BACKEND, can(PERMISSION.USER_MANAGE));
  const [state, setState] = useState<PetListState>(INITIAL_LIST_STATE);
  // Draft spesies yang sedang diedit di panel Filter (belum berlaku sebelum "Apply").
  const [draftSpeciesId, setDraftSpeciesId] = useState("");

  // Ketikan di-debounce supaya server tidak ditembak di tiap huruf.
  const search = useDebouncedValue(state.search);
  const pets = usePetList(buildPetListQuery(state, search));
  const species = useSpecies();

  const items = pets.page?.items ?? [];
  const loading = pets.isPending;
  const filtersActive = hasActiveFilters(state);

  /** Dipanggil saat panel Filter dibuka: salin filter berlaku ke draft. */
  function openFilters() {
    setDraftSpeciesId(state.speciesId);
  }

  /** Dipanggil oleh "Apply": draft menjadi filter berlaku, kembali ke halaman 1. */
  function applyFilters() {
    setState((s) => ({ ...s, speciesId: draftSpeciesId, page: 1 }));
  }

  /** Dipanggil oleh "Reset": kosongkan draft dan filter berlaku. */
  function resetFilters() {
    setDraftSpeciesId("");
    setState((s) => ({ ...s, speciesId: "", page: 1 }));
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <ListPageHeader
        title="Pets"
        description="Registered pets, their species, morph and owners."
        action={
          <Link
            href={ROUTES.pets.create}
            className={cn(
              buttonVariants(),
              "min-h-11 rounded-xl px-4.5 text-[15px] font-bold",
            )}
          >
            New pet
          </Link>
        }
      />

      {features.serverFilters && (
        <ListToolbar
          searchLabel="Search pet or owner"
          search={state.search}
          onSearchChange={(value) =>
            setState((s) => ({ ...s, search: value, page: 1 }))
          }
        >
          <FilterSheet
            activeCount={state.speciesId ? 1 : 0}
            onOpen={openFilters}
            onApply={applyFilters}
            onReset={resetFilters}
          >
            <div className="grid gap-2">
              <b className="text-sm">Species</b>
              <div className="flex flex-wrap gap-2">
                <SpeciesChip
                  label="All"
                  selected={draftSpeciesId === ""}
                  onSelect={() => setDraftSpeciesId("")}
                />
                {species.data?.map((item) => (
                  <SpeciesChip
                    key={item.id}
                    label={item.name}
                    selected={draftSpeciesId === item.id}
                    onSelect={() => setDraftSpeciesId(item.id)}
                  />
                ))}
              </div>
            </div>
          </FilterSheet>
        </ListToolbar>
      )}

      {pets.isError ? (
        <ErrorState
          error={pets.error}
          fallback="Unable to load pets."
          onRetry={() => pets.refetch()}
        />
      ) : loading ? (
        <div
          className="border-border grid gap-px overflow-hidden rounded-2xl border bg-white"
          aria-busy
          aria-label="Loading pets"
        >
          {Array.from({ length: state.perPage }, (_, i) => (
            <Skeleton key={i} className="h-19 rounded-none" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          message={
            filtersActive
              ? "No pets match your search."
              : "No pets yet. Add the first one."
          }
          action={
            filtersActive
              ? undefined
              : { label: "New pet", href: ROUTES.pets.create }
          }
        />
      ) : (
        <div
          className={cn(
            "border-border divide-border divide-y overflow-hidden rounded-2xl border bg-white",
            pets.isPlaceholderData && "opacity-60",
          )}
          aria-busy={pets.isPlaceholderData}
        >
          <PetListHeader />
          {items.map((pet) => (
            <PetRow key={pet.id} pet={pet} />
          ))}
        </div>
      )}

      {!pets.isError && (
        <div className="[&>nav]:border-t-0">
          <Pagination
            label="pets"
            page={state.page}
            perPage={state.perPage}
            total={pets.page?.meta.total ?? 0}
            perPageOptions={PER_PAGE_OPTIONS}
            onPageChange={(page) => setState((s) => ({ ...s, page }))}
            onPerPageChange={(perPage) =>
              setState((s) => ({ ...s, perPage, page: 1 }))
            }
          />
        </div>
      )}
    </div>
  );
}

/** Satu chip pilihan spesies di panel Filter. Yang terpilih gelap, yang lain putih bergaris. */
function SpeciesChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "min-h-9 rounded-full px-3.5 text-[13px]",
        selected
          ? "bg-foreground font-bold text-white"
          : "border-input border bg-white font-semibold",
      )}
    >
      {label}
    </button>
  );
}
