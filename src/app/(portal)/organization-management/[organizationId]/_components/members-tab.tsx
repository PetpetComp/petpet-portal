"use client";
import { useState } from "react";
import { Users, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-field";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canChangeMemberRole,
  canRemoveMember,
  roleChoicesFor,
} from "@/domains/organizations/access";
import {
  DEFAULT_MEMBER_PER_PAGE,
  EMPTY_MEMBER_FILTERS,
  MEMBER_PER_PAGE_OPTIONS,
  filterMembers,
  hasMemberFilters,
  pageOf,
  type MemberFilters,
} from "@/domains/organizations/members";
import {
  useChangeMemberRole,
  useOrganization,
  useOrganizationMembers,
  useRemoveMember,
} from "@/domains/organizations/queries";
import {
  MEMBER_ROLES,
  memberRoleLabel,
  type OrganizationMember,
} from "@/domains/organizations/types";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import { useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { RestrictedNote } from "./restricted-note";

/** Lebar kolom: Member, Email, Role, aksi. Sama dengan desain Org-Detail. */
const GRID =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_160px_96px] items-center gap-3 px-5";

/** Kontrol filter lebih kecil dari field form biasa (36px, sesuai desain). */
const filterClass = `${fieldClass} !min-h-9 !rounded-[10px] !px-2.5 !text-[13px]`;

/** Lima baris abu berdenyut selama anggota dimuat. */
function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((n) => (
        <div
          key={n}
          role="row"
          className={cn(GRID, "border-muted border-b py-3")}
        >
          <div role="cell" className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div role="cell">
            <Skeleton className="h-4 w-44" />
          </div>
          <div role="cell">
            <Skeleton className="h-9 w-32" />
          </div>
          <div role="cell" />
        </div>
      ))}
    </>
  );
}

/**
 * Tab Members di detail organisasi (desain Org-Detail): tabel nama, email, peran, dengan baris
 * filter dan paging. Dropdown ubah peran hanya muncul bagi yang boleh (OWNER), Remove bagi
 * OWNER/ADMIN dengan konfirmasi; semua keputusan hak ada di `domains/organizations/access.ts`.
 * Filter dan paging dikerjakan di browser karena endpoint mengirim seluruh anggota.
 * Dipanggil dari `members/page`.
 */
export function MembersTab({ organizationId }: { organizationId: string }) {
  const rights = useOrganizationRights(organizationId);
  const organization = useOrganization(organizationId);
  const members = useOrganizationMembers(organizationId, rights.canViewMembers);
  const changeRole = useChangeMemberRole(organizationId);
  const remove = useRemoveMember(organizationId);
  const { user, refreshSession } = useAuth();
  const [filters, setFilters] = useState<MemberFilters>(EMPTY_MEMBER_FILTERS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_MEMBER_PER_PAGE);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);

  if (!rights.canViewMembers)
    return (
      <RestrictedNote>
        Only members of this organization can see its member list.
      </RestrictedNote>
    );

  const all = members.data ?? [];
  const filtered = filterMembers(all, filters);
  const rows = pageOf(filtered, page, perPage);
  const filtersActive = hasMemberFilters(filters);

  function changeFilters(patch: Partial<MemberFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  /** Bila yang diubah akun sendiri, hak di sesi ikut dimuat ulang. */
  function refreshIfSelf(member: OrganizationMember) {
    if (member.userId === user?.id) void refreshSession();
  }

  function changeRoleTo(member: OrganizationMember, role: string) {
    if (role === member.role) return;
    changeRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => {
          toast.success(`${member.name} is now ${memberRoleLabel(role)}`);
          refreshIfSelf(member);
        },
        onError: (cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "Unable to change the role.",
          ),
      },
    );
  }

  function confirmRemove() {
    if (!removing) return;
    const member = removing;
    remove.mutate(member.userId, {
      onSuccess: () => {
        toast.success(`${member.name} removed`);
        refreshIfSelf(member);
      },
      onError: (cause) =>
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Unable to remove this member.",
        ),
    });
  }

  return (
    <section className="grid gap-4">
      <p className="text-muted-foreground leading-[21px]">
        Members are existing users. One user can belong to several
        organizations, with a different role in each. Owner manages members and
        payouts; Admin runs events; Staff can be assigned to competitions.
      </p>

      {members.isError ? (
        <ErrorState
          error={members.error}
          fallback="Unable to load the members."
          onRetry={() => members.refetch()}
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-2xl border bg-white">
          <div role="table" aria-label="Members" className="min-w-180">
            <div
              role="row"
              className={cn(
                GRID,
                "border-border text-muted-foreground border-b py-3 text-xs font-bold tracking-[0.06em]",
              )}
            >
              <div role="columnheader">MEMBER</div>
              <div role="columnheader">EMAIL</div>
              <div role="columnheader">ROLE IN THIS ORG</div>
              <div role="columnheader">
                <span className="sr-only">Actions</span>
              </div>
            </div>
            <div
              role="row"
              className={cn(
                GRID,
                "border-border bg-primary-soft/40 border-b py-2.5",
              )}
            >
              <div role="cell">
                <input
                  type="text"
                  aria-label="Filter member"
                  placeholder="Name"
                  value={filters.name}
                  onChange={(e) => changeFilters({ name: e.target.value })}
                  className={filterClass}
                />
              </div>
              <div role="cell">
                <input
                  type="text"
                  aria-label="Filter email"
                  placeholder="Email"
                  value={filters.email}
                  onChange={(e) => changeFilters({ email: e.target.value })}
                  className={filterClass}
                />
              </div>
              <div role="cell">
                <select
                  aria-label="Filter role"
                  value={filters.role}
                  onChange={(e) =>
                    changeFilters({
                      role: e.target.value as MemberFilters["role"],
                    })
                  }
                  className={filterClass}
                >
                  <option value="">All roles</option>
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {memberRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div role="cell">
                <button
                  type="button"
                  aria-label="Clear filters"
                  title="Clear filters"
                  disabled={!filtersActive}
                  onClick={() => {
                    setFilters(EMPTY_MEMBER_FILTERS);
                    setPage(1);
                  }}
                  className="text-muted-foreground hover:text-primary-dark grid size-8 place-items-center rounded-[10px] disabled:opacity-40"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </div>

            {members.isPending && <SkeletonRows />}

            {rows.map((member) => {
              const editable = canChangeMemberRole(rights, member, all);
              const removable = canRemoveMember(rights, member, all);
              const busy =
                changeRole.isPending &&
                changeRole.variables?.userId === member.userId;
              return (
                <div
                  role="row"
                  key={member.id}
                  className={cn(
                    GRID,
                    "border-muted border-b py-3 last:border-b-0",
                  )}
                >
                  <div role="cell" className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="bg-primary-soft text-primary-dark grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                    >
                      {initials(member.name, "?")}
                    </span>
                    <b className="min-w-0 break-words">{member.name}</b>
                  </div>
                  <div role="cell" className="min-w-0 break-all">
                    {member.email ?? "-"}
                  </div>
                  <div role="cell">
                    {editable ? (
                      <select
                        aria-label={`Role of ${member.name}`}
                        value={member.role}
                        disabled={busy}
                        onChange={(e) => changeRoleTo(member, e.target.value)}
                        className={`${fieldClass} !min-h-9.5 !rounded-[10px] !px-2 !text-[13px] !font-semibold`}
                      >
                        {roleChoicesFor(member.role).map((r) => (
                          <option key={r} value={r}>
                            {memberRoleLabel(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="bg-primary-soft text-primary-dark rounded-full px-2.5 py-0.5 text-xs font-bold">
                        {memberRoleLabel(member.role)}
                      </span>
                    )}
                  </div>
                  <div role="cell">
                    {removable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-9.5"
                        aria-label={`Remove ${member.name}`}
                        onClick={() => setRemoving(member)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {!members.isPending && filtered.length === 0 && (
              <div className="grid justify-items-center gap-3 p-6">
                <EmptyState
                  icon={Users}
                  message={
                    filtersActive
                      ? "No members match these filters."
                      : "This organization has no members."
                  }
                />
                {filtersActive && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilters(EMPTY_MEMBER_FILTERS);
                      setPage(1);
                    }}
                  >
                    Show all members
                  </Button>
                )}
              </div>
            )}

            <div className="px-1 [&>nav]:border-t-0">
              <Pagination
                label="members"
                page={page}
                perPage={perPage}
                total={filtered.length}
                perPageOptions={MEMBER_PER_PAGE_OPTIONS}
                onPageChange={setPage}
                onPerPageChange={(next) => {
                  setPerPage(next);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove member"
        description={
          removing
            ? `Remove ${removing.name} (${memberRoleLabel(removing.role)}) from ${organization.data?.name ?? "this organization"}? They lose access to the organization and its events right away.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />
    </section>
  );
}
