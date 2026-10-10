"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetitionTypes,
  useEventCompetitions,
} from "@/domains/competitions/queries";
import { useEvent } from "@/domains/events/queries";
import {
  useAssignmentRoles,
  useEventInvitations,
  useEventStaff,
  useRevokeAssignment,
  useRevokeInvitation,
} from "@/domains/staff/queries";
import { roleLabel } from "@/domains/staff/roles";
import type { PendingInvitation, StaffMember } from "@/domains/staff/types";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  buildCommitteeGroups,
  defaultOpenKeys,
} from "../_lib/committee-groups";
import { CommitteeGroupCard } from "./committee-group-card";
import { InviteMemberDrawer } from "./invite-member-drawer";

/** Keadaan drawer undang. `key` naik tiap dibuka supaya isian mulai bersih. */
type DrawerState = { open: boolean; key: number; target: string };

/** Yang sedang menunggu konfirmasi: mencabut anggota, atau mencabut undangan. */
type Pending =
  | { kind: "member"; member: StaffMember; groupTitle: string }
  | { kind: "invitation"; invitation: PendingInvitation; groupTitle: string };

/** Tiga kartu abu berdenyut selama data dimuat. */
function CommitteeSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading committee">
      {[0, 1, 2].map((n) => (
        <Skeleton key={n} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * Tab Committee event (F2.3): grup "Event team" lalu satu kartu per kompetisi, berisi anggota
 * dan undangan Pending. Tombol "Invite member" membuka drawer; Remove dan Revoke meminta
 * konfirmasi dan hanya muncul bila API mengirim `actions.revoke`.
 * Dipanggil dari `(workspace)/committee/page.tsx`. Data hanya lewat hook `domains/staff`.
 */
export function EventCommittee({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const competitions = useEventCompetitions(eventId);
  const types = useCompetitionTypes();
  const roles = useAssignmentRoles();
  const staff = useEventStaff(eventId);
  const invitations = useEventInvitations(eventId);
  const revokeAssignment = useRevokeAssignment(eventId);
  const revokeInvitation = useRevokeInvitation(eventId);
  const [drawer, setDrawer] = useState<DrawerState>({
    open: false,
    key: 0,
    target: "",
  });
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Pending | null>(null);

  const roleList = roles.data ?? [];
  const groups = buildCommitteeGroups({
    competitions: competitions.data ?? [],
    types: types.data ?? [],
    roles: roleList,
    members: staff.data ?? [],
    invitations: invitations.data ?? [],
  });
  const openByDefault = defaultOpenKeys(groups);

  /** Terbuka bila pengguna pernah mengubahnya, selain itu ikut aturan awal. */
  const isOpen = (key: string) => toggled[key] ?? openByDefault.includes(key);

  function openDrawer(target: string) {
    setDrawer((d) => ({ open: true, key: d.key + 1, target }));
  }

  /** Dipanggil setelah pengguna menekan Remove/Revoke di dialog konfirmasi. */
  function confirmPending() {
    if (!pending) return;
    const done = (text: string) => () => toast.success(text);
    const failed = (fallback: string) => (cause: unknown) =>
      toast.error(cause instanceof Error ? cause.message : fallback);
    if (pending.kind === "member")
      revokeAssignment.mutate(pending.member.id, {
        onSuccess: done(`${pending.member.name} removed`),
        onError: failed("Unable to remove this member."),
      });
    else
      revokeInvitation.mutate(pending.invitation.id, {
        onSuccess: done("Invitation revoked"),
        onError: failed("Unable to revoke this invitation."),
      });
  }

  const loading =
    competitions.isPending ||
    staff.isPending ||
    roles.isPending ||
    types.isPending;
  const failure = competitions.isError
    ? competitions
    : staff.isError
      ? staff
      : null;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-160">
          Invite people by email and assign a role per competition. Assigned
          staff see their competitions under My assignments.
        </p>
        <Can permission={PERMISSION.STAFF_INVITE}>
          <Button
            onClick={() => openDrawer("")}
            className="min-h-11"
            disabled={loading || !!failure}
          >
            <Plus size={16} aria-hidden /> Invite member
          </Button>
        </Can>
      </div>

      {invitations.isError && (
        <p role="status" className="bg-warning-soft rounded-xl p-3 text-sm">
          Pending invitations could not be loaded
          {invitations.error instanceof Error
            ? `: ${invitations.error.message}`
            : "."}
        </p>
      )}

      {failure ? (
        <ErrorState
          error={failure.error}
          fallback="Unable to load the committee."
          onRetry={() => {
            void competitions.refetch();
            void staff.refetch();
          }}
        />
      ) : loading ? (
        <CommitteeSkeleton />
      ) : (
        <>
          {groups.length === 1 && (
            <p className="text-muted-foreground text-sm">
              This event has no competitions yet. Add one in the Competitions
              tab to assign people to it.
            </p>
          )}
          {groups.map((group) => (
            <CommitteeGroupCard
              key={group.key}
              group={group}
              roles={roleList}
              open={isOpen(group.key)}
              onToggle={() =>
                setToggled((t) => ({ ...t, [group.key]: !isOpen(group.key) }))
              }
              onInvite={() => openDrawer(group.key)}
              onRemove={(member) =>
                setPending({ kind: "member", member, groupTitle: group.title })
              }
              onRevoke={(invitation) =>
                setPending({
                  kind: "invitation",
                  invitation,
                  groupTitle: group.title,
                })
              }
            />
          ))}
        </>
      )}

      <InviteMemberDrawer
        key={drawer.key}
        eventId={eventId}
        organizationId={event.data?.organizationId}
        competitions={competitions.data ?? []}
        roles={roleList}
        initialTarget={drawer.target}
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === "invitation" ? "Revoke invitation" : "Remove member"
        }
        description={
          pending?.kind === "invitation"
            ? `Revoke the ${roleLabel(roleList, pending.invitation.role)} invitation sent to ${pending.invitation.email} for ${pending.groupTitle}? They will no longer be able to accept it.`
            : pending
              ? `Remove ${pending.member.name} (${roleLabel(roleList, pending.member.role)}) from ${pending.groupTitle}? They lose access to it right away.`
              : ""
        }
        confirmLabel={pending?.kind === "invitation" ? "Revoke" : "Remove"}
        onConfirm={confirmPending}
      />
    </section>
  );
}
