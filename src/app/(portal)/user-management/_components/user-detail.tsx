"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-field";
import {
  InfoList,
  PageColumns,
  SectionCard,
} from "@/components/common/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAssignRole,
  useDeactivateUser,
  useRevokeRole,
  useRoles,
  useUser,
} from "@/domains/users/queries";
import { assignableRoles, sortRoles } from "@/domains/users/roles";
import { GENDER_LABEL, type User, type UserRole } from "@/domains/users/types";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { UserStatusBadge } from "./user-status-badge";

/** Pesan dari error apa pun untuk toast. */
const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

/**
 * Halaman detail user (`/user-management/[userId]`). Tidak ada di desain: dibuat mengikuti
 * pola header + PageColumns halaman lain (penyimpangan dicatat). Kolom utama: profil dan role
 * platform (beri/cabut); kolom samping: ringkasan dan aksi Edit serta Deactivate. Dipanggil dari `[userId]/page.tsx`.
 */
export function UserDetailPage({ userId }: { userId: string }) {
  const user = useUser(userId);
  if (user.isError)
    return (
      <ErrorState
        error={user.error}
        fallback="Unable to load this user."
        onRetry={() => user.refetch()}
      />
    );
  if (!user.data)
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  return <UserDetail user={user.data} />;
}

/** Isi halaman setelah user berhasil dimuat. */
function UserDetail({ user }: { user: User }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const deactivate = useDeactivateUser(user.id);
  const [confirming, setConfirming] = useState(false);
  const isSelf = me?.id === user.id;

  function confirmDeactivate() {
    deactivate.mutate(undefined, {
      onSuccess: () => {
        toast.success("User deactivated");
        router.push(ROUTES.userManagement);
      },
      onError: (cause) =>
        toast.error(messageOf(cause, "Unable to deactivate the user.")),
    });
  }

  return (
    <div className="grid min-w-0 gap-5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-2"
      >
        <Link
          href={ROUTES.userManagement}
          className="text-primary font-semibold"
        >
          Users
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">{user.name}</span>
      </nav>

      <header className="flex min-w-0 items-center gap-4">
        <UserAvatar initials={user.initials} size="lg" />
        <div className="grid min-w-0 gap-1">
          <h1 className="font-display truncate text-[30px] leading-9 font-bold">
            {user.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">@{user.username}</span>
            <UserStatusBadge status={user.status} />
          </div>
        </div>
      </header>

      <PageColumns
        main={
          <>
            <SectionCard title="Profile">
              <InfoList
                items={[
                  {
                    label: "Email",
                    value: (
                      <>
                        {user.email}
                        {!user.emailVerified && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            (not verified)
                          </span>
                        )}
                      </>
                    ),
                  },
                  { label: "Phone", value: user.phone },
                  {
                    label: "Gender",
                    value: user.gender ? GENDER_LABEL[user.gender] : "",
                  },
                  { label: "City", value: user.city },
                  { label: "Province", value: user.province },
                ]}
              />
            </SectionCard>
            <RolesCard user={user} />
          </>
        }
        aside={
          <>
            <SectionCard title="Summary">
              <InfoList
                items={[
                  { label: "Username", value: `@${user.username}` },
                  {
                    label: "Status",
                    value: <UserStatusBadge status={user.status} />,
                  },
                  {
                    label: "Email",
                    value: user.emailVerified ? "Verified" : "Not verified",
                  },
                  { label: "Roles", value: String(user.roles.length) },
                ]}
              />
            </SectionCard>
            <Can permission={PERMISSION.USER_MANAGE}>
              <SectionCard title="Actions">
                <Link
                  href={ROUTES.users.edit(user.id)}
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "min-h-11 w-full rounded-xl font-bold",
                  )}
                >
                  Edit
                </Link>
                {user.status !== "SUSPENDED" && !isSelf && (
                  <div className="border-border grid gap-2 border-t pt-4">
                    <p className="text-muted-foreground text-[13px]">
                      Suspends the account. It can no longer sign in.
                    </p>
                    <Button
                      variant="destructive"
                      className="min-h-11 w-full rounded-xl"
                      disabled={deactivate.isPending}
                      onClick={() => setConfirming(true)}
                    >
                      Deactivate
                    </Button>
                  </div>
                )}
              </SectionCard>
            </Can>
          </>
        }
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Deactivate user"
        description={`Deactivate ${user.name}? The account is suspended and can no longer sign in. The user stays in the list as Suspended.`}
        confirmLabel="Deactivate"
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}

/**
 * Kartu role platform: chip role dengan tombol cabut (konfirmasi), plus pilihan "Add role".
 * Role yang ditawarkan datang dari `GET /auth/roles`; SUPER_ADMIN hanya untuk super admin
 * (aturan sebenarnya di backend, di sini hanya menyembunyikan). Aksi hanya muncul untuk
 * yang punya `user.manage`.
 */
function RolesCard({ user }: { user: User }) {
  const { can, hasRole } = useAuth();
  const roles = useRoles();
  const assign = useAssignRole(user.id);
  const revoke = useRevokeRole(user.id);
  const [toRevoke, setToRevoke] = useState<UserRole | null>(null);
  const [selected, setSelected] = useState("");
  const manage = can(PERMISSION.USER_MANAGE);

  const held = new Set(user.roles.map((r) => r.code));
  const addable = assignableRoles(
    sortRoles(roles.data ?? []),
    hasRole("SUPER_ADMIN"),
  ).filter((r) => !held.has(r.code));

  function addRole() {
    if (!selected) return;
    assign.mutate(selected, {
      onSuccess: () => {
        toast.success("Role added");
        setSelected("");
      },
      onError: (cause) =>
        toast.error(messageOf(cause, "Unable to add the role.")),
    });
  }

  function revokeRole() {
    if (!toRevoke) return;
    revoke.mutate(toRevoke.code, {
      onSuccess: () => toast.success("Role removed"),
      onError: (cause) =>
        toast.error(messageOf(cause, "Unable to remove the role.")),
    });
  }

  return (
    <SectionCard
      title="Platform roles"
      description="Global permissions. Org roles are set on the organization; event duties come from assignments."
    >
      <p className="text-muted-foreground text-[13px]">
        See{" "}
        <Link href={ROUTES.rolesAccess} className="text-primary font-bold">
          Roles &amp; access
        </Link>{" "}
        for what each role can do.
      </p>

      {user.roles.length === 0 ? (
        <p className="text-muted-foreground">This user has no platform role.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <li
              key={role.code}
              className="bg-primary-soft text-primary-dark flex min-h-9 items-center gap-1.5 rounded-full pr-1.5 pl-3.5 text-sm font-bold"
            >
              {role.name}
              {manage && (
                <button
                  type="button"
                  aria-label={`Remove role ${role.name}`}
                  disabled={revoke.isPending}
                  onClick={() => setToRevoke(role)}
                  className="hover:bg-primary/15 grid size-6 place-items-center rounded-full disabled:opacity-50"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {manage && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Role to add"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={cn(fieldClass, "max-w-64")}
          >
            <option value="">Add a role...</option>
            {addable.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            className="min-h-11 rounded-xl"
            disabled={!selected || assign.isPending}
            onClick={addRole}
          >
            Add role
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={toRevoke !== null}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title="Remove role"
        description={`Remove the ${toRevoke?.name ?? ""} role from ${user.name}? Their permissions change right away.`}
        confirmLabel="Remove role"
        onConfirm={revokeRole}
      />
    </SectionCard>
  );
}
