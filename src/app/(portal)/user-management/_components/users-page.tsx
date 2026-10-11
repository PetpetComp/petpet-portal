"use client";
import { useState } from "react";
import Link from "next/link";
import { Can } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { FilterSheet } from "@/components/common/filter-sheet";
import { ListPageHeader } from "@/components/common/list-page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { Pagination } from "@/components/ui/pagination";
import {
  EMPTY_USER_FILTERS,
  INITIAL_USER_LIST_STATE,
  PER_PAGE_OPTIONS,
  buildUserListQuery,
  hasActiveUserFilters,
  nextUserSort,
  type UserColumnFilters,
  type UserListState,
} from "@/domains/users/list-state";
import { useRoles, useUsers } from "@/domains/users/queries";
import { sortRoles } from "@/domains/users/roles";
import {
  USER_STATUSES,
  USER_STATUS_LABEL,
  type UserSort,
  type UserStatus,
} from "@/domains/users/types";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PERMISSION } from "@/lib/auth/permissions";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { UsersTable } from "./users-table";

/** Filter di dalam panel Filter (semua kecuali pencarian nama). */
type FilterDraft = Pick<
  UserColumnFilters,
  "role" | "status" | "email" | "phone" | "city"
>;

/** Ambil bagian panel dari filter yang sedang berlaku. */
function draftFrom(filters: UserColumnFilters): FilterDraft {
  const { role, status, email, phone, city } = filters;
  return { role, status, email, phone, city };
}

/**
 * Halaman list user (`/user-management`).
 * Pencarian nama ada di atas tabel (di-debounce), filter lain ada di panel Filter dengan pola
 * DRAFT: panel mengubah `draft`, baru masuk ke `state.filters` saat Apply. Urutan dan paging
 * dikirim ke server lewat `useUsers`. Di mode backend asli (yang baru mendukung `q`, `role`,
 * `status`) filter email, telepon, kota dan urutan disembunyikan (docs 08 bagian 9.3,
 * docs 09 bagian P). Dipanggil dari `page.tsx`.
 */
export function UsersPage() {
  const { can } = useAuth();
  const [state, setState] = useState<UserListState>(INITIAL_USER_LIST_STATE);
  const [draft, setDraft] = useState<FilterDraft>(
    draftFrom(INITIAL_USER_LIST_STATE.filters),
  );
  const roles = useRoles();
  const extraFilters = USING_MOCK_BACKEND;

  // Ketikan pencarian di-debounce supaya server tidak ditembak di tiap huruf.
  const name = useDebouncedValue(state.filters.name);
  const users = useUsers(
    buildUserListQuery(state, {
      name,
      email: state.filters.email,
      phone: state.filters.phone,
      city: state.filters.city,
    }),
  );

  /** Jumlah filter berlaku di panel (pencarian tidak dihitung). */
  const activeCount = [
    state.filters.role,
    state.filters.status,
    extraFilters ? state.filters.email.trim() : "",
    extraFilters ? state.filters.phone.trim() : "",
    extraFilters ? state.filters.city.trim() : "",
  ].filter(Boolean).length;

  /** Ubah pencarian nama, lalu kembali ke halaman 1. */
  function changeSearch(value: string) {
    setState((current) => ({
      ...current,
      filters: { ...current.filters, name: value },
      page: 1,
    }));
  }

  /** Apply: salin draft panel ke filter berlaku, kembali ke halaman 1. */
  function applyDraft() {
    setState((current) => ({
      ...current,
      filters: { ...current.filters, ...draft },
      page: 1,
    }));
  }

  /** Reset: kosongkan filter panel (draft dan berlaku); pencarian nama tidak disentuh. */
  function resetDraft() {
    const empty = draftFrom(EMPTY_USER_FILTERS);
    setDraft(empty);
    setState((current) => ({
      ...current,
      filters: { ...current.filters, ...empty },
      page: 1,
    }));
  }

  function changeSort(sort: UserSort) {
    setState((current) => ({
      ...current,
      ...nextUserSort(current, sort),
      page: 1,
    }));
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <ListPageHeader
        title="Users"
        description="Participants, organizers and staff. Roles are set per user."
        action={
          <Can permission={PERMISSION.USER_MANAGE}>
            <Link
              href={ROUTES.users.create}
              className={cn(
                buttonVariants(),
                "min-h-11 rounded-xl px-[18px] text-[15px] font-bold",
              )}
            >
              New user
            </Link>
          </Can>
        }
      />

      <ListToolbar
        searchLabel="Search name or username"
        search={state.filters.name}
        onSearchChange={changeSearch}
      >
        <FilterSheet
          activeCount={activeCount}
          onOpen={() => setDraft(draftFrom(state.filters))}
          onApply={applyDraft}
          onReset={resetDraft}
        >
          <FormField label="Role">
            <select
              aria-label="Filter role"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              className={fieldClass}
            >
              <option value="">All roles</option>
              {sortRoles(roles.data ?? []).map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select
              aria-label="Filter status"
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as UserStatus | "",
                })
              }
              className={fieldClass}
            >
              <option value="">All</option>
              {USER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {USER_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </FormField>
          {extraFilters && (
            <>
              <FormField label="Email">
                <input
                  type="text"
                  aria-label="Filter email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                  className={fieldClass}
                />
              </FormField>
              <FormField label="Phone">
                <input
                  type="text"
                  aria-label="Filter phone"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                  className={fieldClass}
                />
              </FormField>
              <FormField label="City">
                <input
                  type="text"
                  aria-label="Filter city"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  className={fieldClass}
                />
              </FormField>
            </>
          )}
        </FilterSheet>
      </ListToolbar>

      {users.isError ? (
        <ErrorState
          error={users.error}
          fallback="Unable to load users."
          onRetry={() => users.refetch()}
        />
      ) : (
        <>
          <UsersTable
            users={users.data?.items ?? []}
            loading={users.isPending || users.isPlaceholderData}
            features={{ extraFilters }}
            onClearFilters={() =>
              setState((current) => ({
                ...current,
                filters: EMPTY_USER_FILTERS,
                page: 1,
              }))
            }
            filtersActive={hasActiveUserFilters(state.filters)}
            sort={state.sort}
            direction={state.direction}
            onSortChange={changeSort}
            canCreate={can(PERMISSION.USER_MANAGE)}
          />
          <div className="[&>nav]:border-t-0">
            <Pagination
              label="users"
              page={state.page}
              perPage={state.perPage}
              total={users.data?.meta.total ?? 0}
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
