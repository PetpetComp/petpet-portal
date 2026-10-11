"use client";
import { useState } from "react";
import Link from "next/link";
import { Can } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
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
import type { UserSort } from "@/domains/users/types";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PERMISSION } from "@/lib/auth/permissions";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { UsersTable } from "./users-table";

/**
 * Halaman list user (`/user-management`), sesuai desain Users.
 * Filter per kolom, urutan, dan paging dikirim ke server lewat `useUsers`. Di mode backend
 * asli (yang baru mendukung `q`, `role`, `status`) filter email, telepon, kota dan urutan
 * disembunyikan (docs 08 bagian 9.3, docs 09 bagian P). Dipanggil dari `page.tsx`.
 */
export function UsersPage() {
  const { can } = useAuth();
  const [state, setState] = useState<UserListState>(INITIAL_USER_LIST_STATE);
  const roles = useRoles();
  const extraFilters = USING_MOCK_BACKEND;

  // Ketikan di-debounce supaya server tidak ditembak di tiap huruf.
  const name = useDebouncedValue(state.filters.name);
  const email = useDebouncedValue(state.filters.email);
  const phone = useDebouncedValue(state.filters.phone);
  const city = useDebouncedValue(state.filters.city);
  const users = useUsers(
    buildUserListQuery(state, { name, email, phone, city }),
  );

  /** Ubah filter, lalu kembali ke halaman 1 (hasil berubah, nomor halaman lama tak berarti). */
  function changeFilters(patch: Partial<UserColumnFilters>) {
    setState((current) => ({
      ...current,
      filters: { ...current.filters, ...patch },
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 className="font-display text-[34px] leading-[38px] font-bold">
            Users
          </h1>
          <p className="text-muted-foreground text-[15px]">
            Participants, organizers and staff. Roles are set per user.
          </p>
        </div>
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
      </header>

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
            roles={sortRoles(roles.data ?? [])}
            loading={users.isPending || users.isPlaceholderData}
            features={{ extraFilters }}
            filters={state.filters}
            onFilterChange={changeFilters}
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
