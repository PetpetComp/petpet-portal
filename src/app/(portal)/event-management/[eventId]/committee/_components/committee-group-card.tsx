"use client";
import { ChevronDown, Mail, Plus } from "lucide-react";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { COMPETITION_KIND_LABEL } from "@/domains/events/overview";
import { roleLabel } from "@/domains/staff/roles";
import type {
  AssignmentRole,
  PendingInvitation,
  StaffMember,
} from "@/domains/staff/types";
import { PERMISSION } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import { initials } from "@/lib/identity";
import { cn } from "@/lib/utils";
import {
  KIND_CHIP_CLASS,
  groupCountLabel,
  kindChipLabel,
  roleChipClass,
  type CommitteeGroup,
} from "../_lib/committee-groups";

/** Dasar bentuk chip kecil (peran, jenis lomba, Pending) sesuai DS-Foundations. */
const CHIP = "rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap";

/**
 * Satu kartu di tab Committee: tim event atau satu kompetisi. Header bisa diklik untuk
 * membuka/melipat; isinya daftar anggota lalu undangan Pending.
 * Dipanggil dari `EventCommittee` untuk setiap grup.
 * - `onInvite`: tombol "Invite" di header (target awal drawer = grup ini), hanya untuk yang
 *   punya `staff.invite`.
 * - `onRemove` / `onRevoke`: dipanggil saat tombolnya diklik; konfirmasi ada di pemanggil.
 *   Tombolnya hanya muncul bila API mengirim `actions.revoke` (aturan bisnis ada di backend).
 */
export function CommitteeGroupCard({
  group,
  roles,
  open,
  onToggle,
  onInvite,
  onRemove,
  onRevoke,
}: {
  group: CommitteeGroup;
  roles: AssignmentRole[];
  open: boolean;
  onToggle: () => void;
  onInvite: () => void;
  onRemove: (member: StaffMember) => void;
  onRevoke: (invitation: PendingInvitation) => void;
}) {
  const bodyId = `committee-group-${group.key}`;
  const isEmpty = group.members.length + group.invitations.length === 0;
  return (
    <section
      aria-label={group.title}
      className="border-border overflow-hidden rounded-2xl border bg-white"
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3",
          open && "border-border border-b",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-left"
        >
          {group.kind && (
            <span className={cn(CHIP, KIND_CHIP_CLASS[group.kind])}>
              {kindChipLabel(COMPETITION_KIND_LABEL[group.kind])}
            </span>
          )}
          <b className="min-w-0 text-base break-words">{group.title}</b>
          <span className="text-muted-foreground ml-auto">
            {groupCountLabel(group)}
          </span>
          <span className="text-primary inline-flex items-center gap-1 font-bold">
            {open ? "Close" : "Open"}
            <ChevronDown
              size={16}
              aria-hidden
              className={cn("transition-transform", open && "rotate-180")}
            />
          </span>
        </button>
        <Can permission={PERMISSION.STAFF_INVITE}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onInvite}
            aria-label={`Invite to ${group.title}`}
          >
            <Plus size={14} aria-hidden /> Invite
          </Button>
        </Can>
      </div>

      {open && (
        <div id={bodyId}>
          {isEmpty && (
            <p className="text-muted-foreground px-5 py-5">
              No one is assigned yet.
            </p>
          )}
          <ul>
            {group.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                roles={roles}
                onRemove={() => onRemove(member)}
              />
            ))}
            {group.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                roles={roles}
                onRevoke={() => onRevoke(invitation)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Lingkaran inisial (36px) seperti desain. */
function Avatar({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="bg-primary-soft text-primary-dark grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
    >
      {text}
    </span>
  );
}

/** Baris satu anggota: avatar, nama, email, chip peran, dan tombol Remove (bila boleh). */
function MemberRow({
  member,
  roles,
  onRemove,
}: {
  member: StaffMember;
  roles: AssignmentRole[];
  onRemove: () => void;
}) {
  return (
    <li className="border-muted flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b px-5 py-3 last:border-b-0">
      <Avatar text={initials(member.name, "?")} />
      <span className="flex min-w-0 flex-1 basis-40 flex-col">
        <b className="break-words">{member.name}</b>
        {member.email && (
          <span className="text-muted-foreground text-[13px] break-all">
            {member.email}
          </span>
        )}
      </span>
      <span className={cn(CHIP, roleChipClass(member.role))}>
        {roleLabel(roles, member.role)}
      </span>
      {member.canRevoke && (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-10"
          onClick={onRemove}
          aria-label={`Remove ${member.name}`}
        >
          Remove
        </Button>
      )}
    </li>
  );
}

/** Baris satu undangan Pending: email (dan nama bila sudah punya akun), chip Pending, peran, Revoke. */
function InvitationRow({
  invitation,
  roles,
  onRevoke,
}: {
  invitation: PendingInvitation;
  roles: AssignmentRole[];
  onRevoke: () => void;
}) {
  return (
    <li className="border-muted bg-background/60 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b px-5 py-3 last:border-b-0">
      <span
        aria-hidden
        className="text-primary-dark grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-current bg-white"
      >
        <Mail size={16} />
      </span>
      <span className="flex min-w-0 flex-1 basis-40 flex-col">
        <b className="break-all">{invitation.email}</b>
        <span className="text-muted-foreground text-[13px]">
          {[
            invitation.inviteeName,
            invitation.expiresAt
              ? `Expires ${formatDate(invitation.expiresAt)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Invitation sent"}
        </span>
      </span>
      <span className={cn(CHIP, "bg-warning-soft text-checkpoint")}>
        Pending
      </span>
      <span className={cn(CHIP, roleChipClass(invitation.role))}>
        {roleLabel(roles, invitation.role)}
      </span>
      {invitation.canRevoke && (
        <Button
          variant="secondary"
          size="sm"
          className="min-h-10"
          onClick={onRevoke}
          aria-label={`Revoke invitation for ${invitation.email}`}
        >
          Revoke
        </Button>
      )}
    </li>
  );
}
