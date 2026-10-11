"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { findMemberByEmail } from "@/domains/organizations/members";
import {
  useInviteMember,
  useOrganizationMembers,
} from "@/domains/organizations/queries";
import {
  EMPTY_INVITE_VALUES,
  inviteSchema,
  inviteToApiBody,
  serverErrorsToInviteErrors,
  type InviteInput,
  type InviteValues,
} from "@/domains/organizations/schema";
import {
  INVITABLE_ROLES,
  memberRoleLabel,
} from "@/domains/organizations/types";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import type { UserHit } from "@/domains/users/types";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PersonPicker } from "./person-picker";

const FORM_ID = "invite-org-member-form";

/** Cara memilih orang: cari user yang sudah punya akun, atau undang lewat email saja. */
type PersonMode = "search" | "email";

/**
 * Drawer kanan "Invite member" organisasi (`POST /organizations/{uuid}/invitations`).
 * Dua langkah: 1 orang (cari user atau "Invite by email"), 2 peran (Admin atau Staff, owner
 * tidak pernah diundang). Hanya email yang dikirim; backend tidak menerima nama atau telepon.
 * Email milik anggota yang sudah ada ditolak di sini (bila emailnya diketahui) dan di mock.
 * Dipanggil dari `OrganizationShell`; di-remount lewat `key` tiap dibuka.
 */
export function InviteMemberDrawer({
  organizationId,
  organizationName,
  open,
  onOpenChange,
}: {
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rights = useOrganizationRights(organizationId);
  const members = useOrganizationMembers(organizationId, rights.canViewMembers);
  const invite = useInviteMember(organizationId);
  const form = useForm<InviteValues, unknown, InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: EMPTY_INVITE_VALUES,
  });
  const { errors } = form.formState;
  const email = useWatch({ control: form.control, name: "email" });
  const role = useWatch({ control: form.control, name: "role" });
  const [mode, setMode] = useState<PersonMode>("search");
  const [chosen, setChosen] = useState<UserHit | null>(null);
  const [submitError, setSubmitError] = useState("");

  function changeMode(next: PersonMode) {
    setMode(next);
    setChosen(null);
    form.setValue("email", "");
    form.clearErrors("email");
  }

  function choose(hit: UserHit) {
    setChosen(hit);
    form.setValue("email", hit.email, { shouldValidate: true });
  }

  /** Kirim undangan. Berhasil -> toast dan tutup. Gagal -> pesan per field + toast. */
  const submit = form.handleSubmit((values) => {
    setSubmitError("");
    if (findMemberByEmail(members.data ?? [], values.email)) {
      form.setError("email", {
        message: "This person is already a member of this organization.",
      });
      return;
    }
    invite.mutate(inviteToApiBody(values), {
      onSuccess: () => {
        toast.success(`Invitation sent to ${values.email}`);
        onOpenChange(false);
      },
      onError: (cause) => {
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to send the invitation.";
        const fieldErrors =
          cause instanceof ApiError
            ? serverErrorsToInviteErrors(cause.errors)
            : {};
        for (const [field, text] of Object.entries(fieldErrors))
          form.setError(field as keyof InviteValues, { message: text });
        if (Object.keys(fieldErrors).length === 0) setSubmitError(message);
        toast.error(message);
      },
    });
  });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Invite member"
      description={`Invite someone to ${organizationName}. They get access once they accept.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={invite.isPending}>
            {invite.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-5">
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-bold">1. Person</legend>
          <div
            role="group"
            aria-label="How to choose the person"
            className="flex flex-wrap gap-2"
          >
            {(
              [
                ["search", "Search user"],
                ["email", "Invite by email"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => changeMode(value)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-semibold",
                  mode === value
                    ? "border-primary bg-primary-soft text-primary-dark"
                    : "border-input bg-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "search" ? (
            <PersonPicker
              organizationId={organizationId}
              chosen={chosen}
              onChoose={choose}
              onClear={() => {
                setChosen(null);
                form.setValue("email", "");
              }}
            />
          ) : (
            <FormField label="Email" required>
              <input
                type="email"
                className={fieldClass}
                autoComplete="off"
                value={email}
                aria-invalid={!!errors.email}
                onChange={(e) => form.setValue("email", e.target.value)}
              />
            </FormField>
          )}
          {errors.email && (
            <span
              role="alert"
              className="text-danger-ink text-[13px] font-semibold"
            >
              {errors.email.message}
            </span>
          )}
        </fieldset>

        <FormField
          label="2. Role"
          error={errors.role?.message}
          hint="Admin runs events. Staff can be assigned to competitions. An owner is never invited."
        >
          <select
            className={fieldClass}
            value={role}
            aria-invalid={!!errors.role}
            onChange={(e) =>
              form.setValue("role", e.target.value as InviteValues["role"])
            }
          >
            {INVITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {memberRoleLabel(r)}
              </option>
            ))}
          </select>
        </FormField>

        {submitError && (
          <p role="alert" className="text-danger-ink font-semibold">
            {submitError}
          </p>
        )}
      </form>
    </Drawer>
  );
}
