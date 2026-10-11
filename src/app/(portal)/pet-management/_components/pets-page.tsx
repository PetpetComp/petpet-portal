"use client";
import { useState } from "react";
import Link from "next/link";
import { PawPrint } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
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
import { PetCard } from "./pet-card";

/** Kelas grid kartu: sebanyak mungkin kolom selebar minimal 250px (desain Pets). */
const GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-3.5";

/**
 * Halaman list pet (`/pet-management`), sesuai desain Pets: judul + "New pet", pencarian,
 * chip spesies, grid kartu, dan pagination.
 *
 * Chip spesies diambil dari `GET /master/species` (temuan D11: desain menulis Dog/Cat tetap,
 * padahal master hanya berisi Sugar Glider). Pencarian, chip, dan paging dikirim ke server lewat
 * `usePetList`. Di mode backend asli pencarian dan chip disembunyikan karena `GET /pets`
 * belum mendukungnya (`petFeatures`); paging tetap jalan (dipotong di sisi klien dari array penuh).
 * Dipanggil dari `pet-management/page.tsx`.
 */
export function PetsPage() {
  const { can } = useAuth();
  const features = petFeatures(USING_MOCK_BACKEND, can(PERMISSION.USER_MANAGE));
  const [state, setState] = useState<PetListState>(INITIAL_LIST_STATE);

  // Ketikan di-debounce supaya server tidak ditembak di tiap huruf.
  const search = useDebouncedValue(state.search);
  const pets = usePetList(buildPetListQuery(state, search));
  const species = useSpecies();

  const items = pets.page?.items ?? [];
  const loading = pets.isPending;
  const filtersActive = hasActiveFilters(state);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[34px] leading-[38px] font-bold">
          Pets
        </h1>
        <Link
          href={ROUTES.pets.create}
          className={cn(
            buttonVariants(),
            "min-h-11 rounded-xl px-[18px] text-[15px] font-bold",
          )}
        >
          New pet
        </Link>
      </header>

      {features.serverFilters && (
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            aria-label="Search pet or owner"
            placeholder="Search pet or owner"
            value={state.search}
            onChange={(e) =>
              setState((s) => ({ ...s, search: e.target.value, page: 1 }))
            }
            className="border-input focus:border-primary min-h-9 w-55 max-w-full rounded-full border bg-white px-3 text-[13px] font-medium outline-none"
          />
          <SpeciesChip
            label="All"
            selected={state.speciesId === ""}
            onSelect={() => setState((s) => ({ ...s, speciesId: "", page: 1 }))}
          />
          {species.data?.map((item) => (
            <SpeciesChip
              key={item.id}
              label={item.name}
              selected={state.speciesId === item.id}
              onSelect={() =>
                setState((s) => ({ ...s, speciesId: item.id, page: 1 }))
              }
            />
          ))}
        </div>
      )}

      {pets.isError ? (
        <ErrorState
          error={pets.error}
          fallback="Unable to load pets."
          onRetry={() => pets.refetch()}
        />
      ) : loading ? (
        <div className={GRID_CLASS} aria-busy aria-label="Loading pets">
          {Array.from({ length: state.perPage }, (_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-2xl" />
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
          className={cn(GRID_CLASS, pets.isPlaceholderData && "opacity-60")}
          aria-busy={pets.isPlaceholderData}
        >
          {items.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
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

/** Satu chip filter spesies. Yang terpilih gelap (desain), yang lain putih bergaris. */
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
