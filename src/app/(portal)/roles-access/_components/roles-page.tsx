"use client";
import { useState } from "react";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissionGroups, useRoles } from "@/domains/users/queries";
import { hasGrantData, sortRoles } from "@/domains/users/roles";
import { AccessModel } from "./access-model";
import { PermissionMatrix } from "./permission-matrix";
import { RoleCards } from "./role-cards";

/** Role yang disorot saat halaman dibuka (desain: Organizer). Bila tidak ada, role pertama. */
const DEFAULT_FOCUS = "ORGANIZER";

/**
 * Halaman Roles & access (`/roles-access`), read-only, sesuai desain Roles.
 * Data dari `GET /auth/roles` dan `GET /auth/permissions` (semua role dari API, bukan 4
 * di desain). Bila API belum mengirim `permissions` per role, matriks tetap tampil dengan
 * tanda "?" dan catatan, supaya tidak ada centang karangan. Dipanggil dari `page.tsx`.
 */
export function RolesPage() {
  const roles = useRoles();
  const permissions = usePermissionGroups();
  const [picked, setPicked] = useState<string | null>(null);

  const sorted = sortRoles(roles.data ?? []);
  const focus =
    picked ??
    (sorted.find((r) => r.code === DEFAULT_FOCUS) ?? sorted[0])?.code ??
    "";
  const failed = roles.isError
    ? roles
    : permissions.isError
      ? permissions
      : null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-display text-[30px] leading-9 font-semibold">
            Roles &amp; permissions
          </h1>
          <span className="text-muted-foreground">
            Who can do what. Pick a role to highlight its column.
          </span>
        </div>
        <span className="bg-warning-soft text-warning rounded-full px-3 py-1.5 text-[13px] font-bold">
          Read-only · roles come from the seeder, backend has no edit endpoint
          yet
        </span>
      </header>

      <AccessModel />

      {failed ? (
        <ErrorState
          error={failed.error}
          fallback="Unable to load roles and permissions."
          onRetry={() => {
            void roles.refetch();
            void permissions.refetch();
          }}
        />
      ) : !roles.data || !permissions.data ? (
        <div className="flex flex-wrap gap-5" aria-busy>
          <Skeleton className="h-80 w-72 rounded-2xl" />
          <Skeleton className="h-80 min-w-0 flex-1 rounded-2xl" />
        </div>
      ) : (
        <>
          {!hasGrantData(sorted) && (
            <p
              role="status"
              className="bg-warning-soft text-warning rounded-xl px-4 py-3 text-[13px] font-semibold"
            >
              The API does not list which permissions each role holds yet, so
              the cells show &quot;?&quot;. The permission list itself is real.
            </p>
          )}
          <div className="flex flex-wrap items-start gap-5">
            <RoleCards roles={sorted} focus={focus} onPick={setPicked} />
            <PermissionMatrix
              roles={sorted}
              groups={permissions.data}
              focus={focus}
            />
          </div>
        </>
      )}
    </div>
  );
}
