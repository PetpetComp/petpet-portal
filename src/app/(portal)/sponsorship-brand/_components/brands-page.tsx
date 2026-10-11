"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { Can } from "@/components/common/can";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ListPageHeader } from "@/components/common/list-page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
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
import { BRAND_ROW_COLUMNS, BrandCard } from "./brand-card";

/** Jumlah baris kerangka saat daftar pertama kali dimuat (satu halaman bawaan). */
const SKELETON_COUNT = 8;

/**
 * Halaman daftar brand (`/sponsorship-brand`): header + tombol New brand, toolbar cari,
 * tabel responsif (kartu di HP), lalu Pagination. Halaman diatur server lewat `useBrandPage`.
 * Daftar brand belum punya filter selain pencarian, jadi tombol Filter belum ditampilkan.
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
      <ListPageHeader
        title="Brands"
        description="Sponsors and media partners. Link them to events from the event's Sponsors tab."
        action={
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
        }
      />

      {searchEnabled && (
        <ListToolbar
          searchLabel="Search brands"
          search={state.search}
          onSearchChange={(value) =>
            setState((s) => ({ ...s, search: value, page: 1 }))
          }
        />
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
              className="border-border grid gap-px overflow-hidden rounded-2xl border bg-white"
            >
              {Array.from({ length: SKELETON_COUNT }, (_, n) => (
                <Skeleton key={n} className="h-[78px] rounded-none" />
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
            <div className="border-border overflow-hidden rounded-2xl border bg-white">
              <div
                aria-hidden
                className={cn(
                  "bg-primary-soft/40 text-muted-foreground border-border hidden gap-3 border-b px-4 py-2.5 text-xs font-bold tracking-wide uppercase md:grid",
                  BRAND_ROW_COLUMNS,
                )}
              >
                <span>Brand</span>
                <span>Contact</span>
                <span>PICs</span>
                <span>Status</span>
                <span />
              </div>
              <ul
                aria-label="Brands"
                aria-busy={loading || undefined}
                className="divide-border divide-y"
              >
                {items.map((brand) => (
                  <li key={brand.id} className="grid">
                    <BrandCard brand={brand} />
                  </li>
                ))}
              </ul>
            </div>
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
