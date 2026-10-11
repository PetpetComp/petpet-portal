"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, UserX } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SortDirection, User, UserSort } from "@/domains/users/types";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { UserStatusBadge } from "./user-status-badge";

/** Lebar kolom: User, Email, Phone, City, Roles, Status, panah. Empat pertama sama dengan desain Users. */
const GRID =
  "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_150px_minmax(0,1fr)_minmax(0,1.2fr)_110px_32px] items-center gap-3 px-5";

/** Fitur tabel yang aktif. Di mode backend asli hanya `q`, `role`, `status` yang didukung server. */
export type UsersTableFeatures = {
  /** Filter email, telepon, kota dan urutan kolom didukung server (hanya mock). */
  extraFilters: boolean;
};

type Props = {
  users: User[];
  loading: boolean;
  features: UsersTableFeatures;
  onClearFilters: () => void;
  filtersActive: boolean;
  sort: UserSort;
  direction: SortDirection;
  onSortChange: (sort: UserSort) => void;
  /** True bila akun boleh membuat user: keadaan kosong menampilkan tautan "Create the first user". */
  canCreate: boolean;
};

/**
 * Tabel list user: header (kolom bisa diurutkan), lalu baris user. Filter tidak ada di sini lagi:
 * pencarian dan panel Filter ada di `UsersPage` (pemanggil memegang state dan query).
 * Kolom Roles dan Status ditambahkan di luar desain (temuan D11 di doc 12).
 * Dapat digulir ke samping di dalam kartu. Dipanggil dari `UsersPage`.
 */
export function UsersTable(props: Props) {
  const { users, loading } = props;
  const empty = !loading && users.length === 0;
  return (
    <div
      className="border-border overflow-x-auto rounded-2xl border bg-white"
      aria-busy={loading || undefined}
    >
      <div role="table" aria-label="Users" className="min-w-[1000px]">
        <HeaderRow {...props} />
        {loading &&
          users.length === 0 &&
          [0, 1, 2, 3, 4].map((n) => <SkeletonRow key={n} />)}
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
        {empty && (
          <div className="p-6">
            {props.filtersActive ? (
              <div className="grid justify-items-center gap-3">
                <EmptyState
                  icon={UserX}
                  message="No users match these filters."
                />
                <Button variant="secondary" onClick={props.onClearFilters}>
                  Show all users
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={UserX}
                message="No users yet."
                action={
                  props.canCreate
                    ? {
                        label: "Create the first user",
                        href: ROUTES.users.create,
                      }
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Satu baris user. Nama menuju halaman detail; panah di ujung kanan untuk sentuhan. */
function UserRow({ user }: { user: User }) {
  const href = ROUTES.users.detail(user.id);
  return (
    <div
      role="row"
      className={cn(GRID, "border-muted border-b py-3 last:border-b-0")}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <UserAvatar initials={user.initials} />
        <div className="flex min-w-0 flex-col">
          <Link
            href={href}
            className="text-foreground truncate text-sm font-bold hover:underline"
          >
            {user.name}
          </Link>
          <span className="text-muted-foreground truncate text-[13px]">
            @{user.username}
          </span>
        </div>
      </div>
      <div role="cell" className="truncate">
        {user.email}
      </div>
      <div role="cell" className="font-mono text-[13px]">
        {user.phone || "-"}
      </div>
      <div role="cell" className="truncate">
        {user.city || "-"}
      </div>
      <div role="cell">
        <RoleChips user={user} />
      </div>
      <div role="cell">
        <UserStatusBadge status={user.status} />
      </div>
      <div role="cell">
        <Link
          href={href}
          aria-label={`Open ${user.name}`}
          className="text-muted-foreground hover:text-primary-dark inline-flex"
        >
          <ChevronRight size={18} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** Dua role pertama sebagai chip kecil, sisanya "+N". Nama role dari API, bukan ditulis di sini. */
function RoleChips({ user }: { user: User }) {
  if (user.roles.length === 0)
    return <span className="text-muted-foreground">-</span>;
  const shown = user.roles.slice(0, 2);
  const rest = user.roles.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((role) => (
        <span
          key={role.code}
          className="bg-primary-soft text-primary-dark rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap"
        >
          {role.name}
        </span>
      ))}
      {rest > 0 && (
        <span
          title={user.roles
            .slice(2)
            .map((r) => r.name)
            .join(", ")}
          className="text-muted-foreground px-1 py-0.5 text-xs font-bold"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div role="row" className={cn(GRID, "border-muted border-b py-3")}>
      <div role="cell" className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div role="cell">
        <Skeleton className="h-4 w-40" />
      </div>
      <div role="cell">
        <Skeleton className="h-4 w-28" />
      </div>
      <div role="cell">
        <Skeleton className="h-4 w-24" />
      </div>
      <div role="cell">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div role="cell">
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div role="cell" />
    </div>
  );
}

/** Judul kolom yang bisa diklik untuk mengurutkan (hanya bila server mendukung). */
function SortableHeader({
  label,
  column,
  props,
}: {
  label: string;
  column: UserSort;
  props: Props;
}) {
  if (!props.features.extraFilters) return <>{label}</>;
  const active = props.sort === column;
  const Arrow = props.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => props.onSortChange(column)}
      className="hover:text-primary-dark inline-flex items-center gap-1.5 font-bold tracking-[0.06em] uppercase"
    >
      {label}
      {active && <Arrow size={13} aria-hidden />}
    </button>
  );
}

function ariaSort(props: Props, column: UserSort) {
  if (!props.features.extraFilters || props.sort !== column) return undefined;
  return props.direction === "asc" ? "ascending" : "descending";
}

function HeaderRow(props: Props) {
  return (
    <div
      role="row"
      className={cn(
        GRID,
        "border-border text-muted-foreground border-b py-3 text-xs font-bold tracking-[0.06em]",
      )}
    >
      <div role="columnheader" aria-sort={ariaSort(props, "name")}>
        <SortableHeader label="USER" column="name" props={props} />
      </div>
      <div role="columnheader" aria-sort={ariaSort(props, "email")}>
        <SortableHeader label="EMAIL" column="email" props={props} />
      </div>
      <div role="columnheader">PHONE</div>
      <div role="columnheader">CITY</div>
      <div role="columnheader">ROLES</div>
      <div role="columnheader">STATUS</div>
      <div role="columnheader">
        <span className="sr-only">Open</span>
      </div>
    </div>
  );
}
