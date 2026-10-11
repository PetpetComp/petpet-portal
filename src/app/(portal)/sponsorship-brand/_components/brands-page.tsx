"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Tag } from "lucide-react";
import { Can } from "@/components/common/can";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  INITIAL_LIST_STATE,
  PER_PAGE_OPTIONS,
  buildBrandListQuery,
  hasActiveSearch,
  type BrandListState,
} from "@/domains/brands/list-state";
import { useBrandPage } from "@/domains/brands/queries";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { BrandCard } from "./brand-card";

/** Jumlah kartu kerangka saat daftar pertama kali dimuat (satu halaman bawaan). */
const SKELETON_COUNT = 8;

/**
 * Halaman daftar brand (`/sponsorship-brand`), sesuai desain Brands: judul, tombol New brand,
 * kotak cari, grid kartu, lalu Pagination. Halaman diatur server lewat `useBrandPage`.
 * Kotak cari hanya muncul di mode mock karena `GET /sponsors` belum punya `q`
 * (docs 08 bagian 9.3, kontrak draf brands). Dipanggil dari `page.tsx`.
 */
export function BrandsPage() {
  const [state, setState] = useState<BrandListState>(INITIAL_LIST_STATE);
  const searchEnabled = USING_MOCK_BACKEND;
  // Ketikan di-debounce supaya server tidak ditembak di tiap huruf.
  const search = useDebouncedValue(state.search);
  const brands = useBrandPage(buildBrandListQuery(state, search));
  const loading = brands.isPending || brands.isPlaceholderData;
  const items = brands.data?.items ?? [];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 className="font-display text-[34px] leading-[38px] font-bold">
            Brands
          </h1>
          <p className="text-muted-foreground text-[15px]">
            Sponsors and media partners. Link them to events from the
            event&apos;s Sponsors tab.
          </p>
        </div>
        <Can permission={PERMISSION.MASTER_MANAGE}>
          <Link
            href={ROUTES.brands.create}
            className={cn(
              buttonVariants(),
              "min-h-11 rounded-xl px-[18px] text-[15px] font-bold",
            )}
          >
            <Plus size={18} aria-hidden />
            New brand
          </Link>
        </Can>
      </header>

      {searchEnabled && (
        <label className="border-input focus-within:border-primary flex min-h-11 w-full max-w-90 items-center gap-2 rounded-xl border bg-white px-3.5">
          <Search size={18} aria-hidden className="text-muted-foreground" />
          <input
            type="search"
            aria-label="Search brands"
            placeholder="Search brand, campaign or handle"
            value={state.search}
            onChange={(e) =>
              setState((s) => ({ ...s, search: e.target.value, page: 1 }))
            }
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
        </label>
      )}

      {brands.isError ? (
        <ErrorState
          error={brands.error}
          fallback="Unable to load brands."
          onRetry={() => brands.refetch()}
        />
      ) : (
        <>
          {loading && items.length === 0 ? (
            <div
              aria-busy
              className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3.5"
            >
              {Array.from({ length: SKELETON_COUNT }, (_, n) => (
                <Skeleton key={n} className="h-29.5 rounded-2xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Tag}
              message={
                hasActiveSearch(state)
                  ? "No brand matches this search."
                  : "No brands yet. Create the first one."
              }
              action={
                hasActiveSearch(state)
                  ? undefined
                  : { label: "New brand", href: ROUTES.brands.create }
              }
            />
          ) : (
            <ul
              aria-label="Brands"
              aria-busy={loading || undefined}
              className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3.5"
            >
              {items.map((brand) => (
                <li key={brand.id} className="grid">
                  <BrandCard brand={brand} />
                </li>
              ))}
            </ul>
          )}
          <div className="[&>nav]:border-t-0">
            <Pagination
              label="brands"
              page={state.page}
              perPage={state.perPage}
              total={brands.data?.meta.total ?? 0}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={(page) => setState((s) => ({ ...s, page }))}
              onPerPageChange={(perPage) =>
                setState((s) => ({ ...s, perPage, page: 1 }))
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
