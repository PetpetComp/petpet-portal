"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationPage } from "@/domains/organizations/queries";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { ROUTES } from "@/lib/constants/routes";
import { OrganizationAvatar, VerifiedBadge } from "./organization-avatar";

/** Pilihan baris per halaman; desain Orgs memakai 10. */
const PER_PAGE_OPTIONS = [10, 20, 50];
const DEFAULT_PER_PAGE = 10;

/** Lima baris abu berdenyut selama daftar dimuat. */
function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading organizations">
      {[0, 1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="border-muted flex items-center gap-3 border-b px-5 py-3"
        >
          <Skeleton className="size-9 shrink-0 rounded-[10px]" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kartu "Verified organizers" di halaman daftar organisasi (desain Orgs): baris inisial, nama,
 * badge Verified, tautan ke detail, dan paging dari server. Kotak cari nama hanya ada di mode
 * mock karena `GET /organizations?q=` belum ada di backend asli (draf kontrak organizations).
 * Dipanggil dari `OrganizationsPage`.
 */
export function VerifiedOrganizations() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const debounced = useDebouncedValue(search);
  const organizations = useOrganizationPage({
    q: USING_MOCK_BACKEND ? debounced : undefined,
    page,
    perPage,
  });
  const items = organizations.data?.items ?? [];
  const loading = organizations.isPending || organizations.isPlaceholderData;
  const searching = search.trim() !== "";

  return (
    <section className="border-border overflow-hidden rounded-2xl border bg-white">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-base font-bold">Verified organizers</h2>
        {USING_MOCK_BACKEND && (
          <label className="border-input focus-within:border-primary flex min-h-10 w-full max-w-64 items-center gap-2 rounded-xl border bg-white px-3 sm:w-64">
            <Search size={16} aria-hidden className="text-muted-foreground" />
            <input
              type="search"
              aria-label="Search organizations"
              placeholder="Search by name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
          </label>
        )}
      </div>

      {organizations.isError ? (
        <div className="p-5">
          <ErrorState
            error={organizations.error}
            fallback="Unable to load organizations."
            onRetry={() => organizations.refetch()}
          />
        </div>
      ) : loading && items.length === 0 ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={Building2}
            message={
              searching
                ? "No organizations match this search."
                : "No organizations yet."
            }
          />
        </div>
      ) : (
        <ul aria-busy={loading || undefined}>
          {items.map((org) => (
            <li key={org.id}>
              <Link
                href={ROUTES.organizations.detail(org.id)}
                className="border-muted hover:bg-muted/50 text-foreground flex min-h-15 items-center gap-3 border-b px-5 py-3"
              >
                <OrganizationAvatar name={org.name} />
                <b className="min-w-0 flex-1 break-words">{org.name}</b>
                <VerifiedBadge />
                <ChevronRight
                  size={16}
                  aria-hidden
                  className="text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!organizations.isError && (
        <div className="px-1 [&>nav]:border-t-0">
          <Pagination
            label="organizations"
            page={page}
            perPage={perPage}
            total={organizations.data?.meta.total ?? 0}
            perPageOptions={PER_PAGE_OPTIONS}
            onPageChange={setPage}
            onPerPageChange={(next) => {
              setPerPage(next);
              setPage(1);
            }}
          />
        </div>
      )}
    </section>
  );
}
