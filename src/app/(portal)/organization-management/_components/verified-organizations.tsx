"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FilterSheet } from "@/components/common/filter-sheet";
import { ListToolbar } from "@/components/common/list-toolbar";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrganizationDirectory,
  useOrganizationPage,
} from "@/domains/organizations/queries";
import type { OrganizationListItem } from "@/domains/organizations/types";
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

/** Filter kontak: organisasi harus punya data yang dicentang. Semua false = tanpa filter. */
type OrgFilters = { hasEmail: boolean; hasPhone: boolean; hasAddress: boolean };
const NO_FILTERS: OrgFilters = {
  hasEmail: false,
  hasPhone: false,
  hasAddress: false,
};

/** Jumlah filter yang aktif (pencarian tidak dihitung). */
function countActive(filters: OrgFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

/** True bila baris lolos semua filter yang aktif. Dipakai di mode filter browser. */
function matchesFilters(org: OrganizationListItem, f: OrgFilters): boolean {
  if (f.hasEmail && !org.email) return false;
  if (f.hasPhone && !org.phone) return false;
  if (f.hasAddress && !org.address) return false;
  return true;
}

/** Satu kotak centang di panel filter. */
function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <input
        type="checkbox"
        className="size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * Kartu "Verified organizers" di halaman daftar organisasi: toolbar (cari nama + tombol Filter),
 * baris padat (inisial, nama, badge Verified, kontak singkat), dan paging.
 * Dua mode data: tanpa filter memakai paging server (`GET /organizations?page=`); bila ada filter
 * (atau pencarian di backend asli yang belum punya `q`) seluruh daftar dimuat sekali lalu
 * disaring dan dipaging di browser. Pola filter DRAFT: panel mengedit `draft`, "Apply" menyalinnya
 * ke `applied`. Dipanggil dari `OrganizationsPage`.
 */
export function VerifiedOrganizations() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [applied, setApplied] = useState<OrgFilters>(NO_FILTERS);
  const [draft, setDraft] = useState<OrgFilters>(NO_FILTERS);
  const debounced = useDebouncedValue(search);
  const term = debounced.trim().toLowerCase();
  const activeCount = countActive(applied);
  const clientMode = activeCount > 0 || (!USING_MOCK_BACKEND && term !== "");

  const paged = useOrganizationPage({
    q: USING_MOCK_BACKEND ? debounced : undefined,
    page,
    perPage,
  });
  const directory = useOrganizationDirectory(clientMode);

  // Mode browser: saring seluruh daftar lalu potong halaman aktif.
  const filtered = (directory.data ?? []).filter(
    (org) =>
      matchesFilters(org, applied) &&
      (term === "" || org.name.toLowerCase().includes(term)),
  );
  const items = clientMode
    ? filtered.slice((page - 1) * perPage, page * perPage)
    : (paged.data?.items ?? []);
  const total = clientMode ? filtered.length : (paged.data?.meta.total ?? 0);
  const source = clientMode ? directory : paged;
  const loading = clientMode
    ? directory.isPending
    : paged.isPending || paged.isPlaceholderData;
  const narrowed = term !== "" || activeCount > 0;

  return (
    <section className="grid min-w-0 gap-3">
      <ListToolbar
        searchLabel="Search organizations"
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      >
        <FilterSheet
          activeCount={activeCount}
          onOpen={() => setDraft(applied)}
          onApply={() => {
            setApplied(draft);
            setPage(1);
          }}
          onReset={() => {
            setDraft(NO_FILTERS);
            setApplied(NO_FILTERS);
            setPage(1);
          }}
        >
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-bold">Contact details</legend>
            <CheckRow
              label="Has an email"
              checked={draft.hasEmail}
              onChange={(v) => setDraft((d) => ({ ...d, hasEmail: v }))}
            />
            <CheckRow
              label="Has a phone number"
              checked={draft.hasPhone}
              onChange={(v) => setDraft((d) => ({ ...d, hasPhone: v }))}
            />
            <CheckRow
              label="Has an address"
              checked={draft.hasAddress}
              onChange={(v) => setDraft((d) => ({ ...d, hasAddress: v }))}
            />
          </fieldset>
        </FilterSheet>
      </ListToolbar>

      <div className="border-border overflow-hidden rounded-2xl border bg-white">
        <div className="border-border border-b px-5 py-3.5">
          <h2 className="text-base font-bold">Verified organizers</h2>
        </div>

        {source.isError ? (
          <div className="p-5">
            <ErrorState
              error={source.error}
              fallback="Unable to load organizations."
              onRetry={() => source.refetch()}
            />
          </div>
        ) : loading && items.length === 0 ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Building2}
              message={
                narrowed
                  ? "No organizations match these filters."
                  : "No organizations yet."
              }
            />
          </div>
        ) : (
          <ul aria-busy={loading || undefined}>
            {items.map((org) => {
              const detail = [org.email, org.phone, org.address]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={org.id}>
                  <Link
                    href={ROUTES.organizations.detail(org.id)}
                    className="border-muted hover:bg-muted/50 text-foreground flex min-h-14 items-center gap-3 border-b px-4 py-2.5"
                  >
                    <OrganizationAvatar name={org.name} />
                    <span className="grid min-w-0 flex-1">
                      <b className="break-words">{org.name}</b>
                      {detail && (
                        <span className="text-muted-foreground truncate text-[13px]">
                          {detail}
                        </span>
                      )}
                    </span>
                    <VerifiedBadge />
                    <ChevronRight
                      size={16}
                      aria-hidden
                      className="text-muted-foreground shrink-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {!source.isError && (
          <div className="px-1 [&>nav]:border-t-0">
            <Pagination
              label="organizations"
              page={page}
              perPage={perPage}
              total={total}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onPerPageChange={(next) => {
                setPerPage(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
