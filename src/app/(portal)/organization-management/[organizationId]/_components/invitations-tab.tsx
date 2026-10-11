"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isInvitationExpired } from "@/domains/organizations/access";
import {
  useOrganization,
  useOrganizationInvitations,
  useRevokeOrganizationInvitation,
} from "@/domains/organizations/queries";
import {
  memberRoleLabel,
  type OrganizationInvitation,
} from "@/domains/organizations/types";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import { formatDate } from "@/lib/format/date";
import { RestrictedNote } from "./restricted-note";

/** Dasar bentuk chip kecil sesuai DS-Foundations. */
const CHIP = "rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap";

/**
 * Tab Pending invitations: undangan yang belum diterima, dengan peran, masa berlaku
 * (chip Expired bila lewat) dan tombol Revoke dengan konfirmasi. Desain Org-Detail hanya
 * memuat nama tab; isinya mengikuti pola daftar undangan di Committee. Hanya OWNER/ADMIN
 * (atau super admin) yang boleh melihat. Dipanggil dari `invitations/page`.
 */
export function InvitationsTab({ organizationId }: { organizationId: string }) {
  const rights = useOrganizationRights(organizationId);
  const organization = useOrganization(organizationId);
  const invitations = useOrganizationInvitations(
    organizationId,
    rights.canViewInvitations,
  );
  const revoke = useRevokeOrganizationInvitation(organizationId);
  const [pending, setPending] = useState<OrganizationInvitation | null>(null);

  if (!rights.canViewInvitations)
    return (
      <RestrictedNote>
        Only owners and admins of this organization can see its pending
        invitations.
      </RestrictedNote>
    );

  function confirmRevoke() {
    if (!pending) return;
    revoke.mutate(pending.id, {
      onSuccess: () => toast.success("Invitation revoked"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Unable to revoke this invitation.",
        ),
    });
  }

  const items = invitations.data ?? [];
  return (
    <section className="grid gap-4">
      <p className="text-muted-foreground leading-[21px]">
        People you invited who have not accepted yet. An invitation is valid for
        7 days; revoke it to stop it from being accepted.
      </p>

      {invitations.isError ? (
        <ErrorState
          error={invitations.error}
          fallback="Unable to load the invitations."
          onRetry={() => invitations.refetch()}
        />
      ) : invitations.isPending ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="border-border rounded-2xl border bg-white p-6">
          <EmptyState icon={Mail} message="No pending invitations." />
        </div>
      ) : (
        <ul className="border-border overflow-hidden rounded-2xl border bg-white">
          {items.map((invitation) => {
            const expired = isInvitationExpired(invitation);
            return (
              <li
                key={invitation.id}
                className="border-muted flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b px-5 py-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="text-primary-dark grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-current bg-white"
                >
                  <Mail size={16} />
                </span>
                <span className="flex min-w-0 flex-1 basis-40 flex-col">
                  <b className="break-all">{invitation.email}</b>
                  <span className="text-muted-foreground text-[13px]">
                    {expired ? "Expired" : "Expires"}{" "}
                    {formatDate(invitation.expiresAt)}
                  </span>
                </span>
                <span
                  className={`${CHIP} ${expired ? "bg-danger-soft text-danger-ink" : "bg-warning-soft text-checkpoint"}`}
                >
                  {expired ? "Expired" : "Pending"}
                </span>
                <span className={`${CHIP} bg-primary-soft text-primary-dark`}>
                  {memberRoleLabel(invitation.role)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-10"
                  aria-label={`Revoke invitation for ${invitation.email}`}
                  onClick={() => setPending(invitation)}
                >
                  Revoke
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Revoke invitation"
        description={
          pending
            ? `Revoke the ${memberRoleLabel(pending.role)} invitation sent to ${pending.email} for ${organization.data?.name ?? "this organization"}? They will no longer be able to accept it.`
            : ""
        }
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
      />
    </section>
  );
}
