"use client";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField, fieldClass } from "@/components/ui/form-field";
import type { Competition } from "@/domains/competitions/types";
import {
  defaultRoleFor,
  rolesForScope,
  scopeOfTarget,
} from "@/domains/staff/roles";
import {
  EMPTY_INVITE_VALUES,
  EVENT_TARGET_VALUE,
  createInviteSchema,
  inviteToApiBody,
  serverErrorsToInviteErrors,
  targetFromValue,
  type InviteInput,
  type InviteValues,
} from "@/domains/staff/schema";
import { useInviteStaff } from "@/domains/staff/queries";
import type { AssignmentRole } from "@/domains/staff/types";
import { useUserSearch } from "@/domains/users/queries";
import {
  USER_SEARCH_LIMIT,
  USER_SEARCH_MIN_LENGTH,
  type UserHit,
} from "@/domains/users/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError } from "@/lib/api-client";
import { initials } from "@/lib/identity";
import { cn } from "@/lib/utils";

/** Id form, supaya tombol "Send invitation" di footer drawer bisa mengirim form ini. */
const FORM_ID = "invite-member-form";

/** Cara memilih orang: cari user yang sudah punya akun, atau undang lewat email saja. */
type PersonMode = "search" | "email";

/**
 * Drawer kanan "Invite member" (pola `register-pet-drawer.tsx`).
 * Tiga langkah: 1 target (tim event atau satu kompetisi), 2 peran (disaring menurut cakupan
 * target, hanya yang aktif), 3 orang (cari user, atau "Invite by email").
 * Dipanggil dari `EventCommittee`. Komponen ini di-remount (lewat `key`) setiap dibuka, jadi
 * isian selalu mulai bersih dan `initialTarget` (dari tombol Invite pada satu grup) terpakai.
 * - `organizationId`: organisasi event, supaya anggotanya muncul duluan di hasil pencarian.
 * Validasi pakai zod (`domains/staff/schema.ts`); pesan 422 server ditaruh di bawah fieldnya.
 */
export function InviteMemberDrawer({
  eventId,
  organizationId,
  competitions,
  roles,
  initialTarget,
  open,
  onOpenChange,
}: {
  eventId: string;
  organizationId: string | undefined;
  competitions: Competition[];
  roles: AssignmentRole[];
  initialTarget: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invite = useInviteStaff(eventId);
  const schema = useMemo(() => createInviteSchema(roles), [roles]);
  const form = useForm<InviteValues, unknown, InviteInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...EMPTY_INVITE_VALUES,
      target: initialTarget,
      role: initialTarget
        ? defaultRoleFor(roles, scopeOfTarget(targetFromValue(initialTarget)))
        : "",
    },
  });
  const { errors } = form.formState;
  const target = useWatch({ control: form.control, name: "target" });
  const role = useWatch({ control: form.control, name: "role" });
  const email = useWatch({ control: form.control, name: "email" });
  const [mode, setMode] = useState<PersonMode>("search");
  const [chosen, setChosen] = useState<UserHit | null>(null);
  const [submitError, setSubmitError] = useState("");

  const offeredRoles = target
    ? rolesForScope(roles, scopeOfTarget(targetFromValue(target)))
    : [];

  /** Ganti target: peran yang tidak cocok dengan cakupan baru dikosongkan (atau diisi otomatis bila hanya satu). */
  function changeTarget(value: string) {
    form.setValue("target", value, {
      shouldValidate: form.formState.isSubmitted,
    });
    const scope = scopeOfTarget(targetFromValue(value));
    const stillOffered = rolesForScope(roles, scope).some(
      (r) => r.code === role,
    );
    if (!stillOffered)
      form.setValue("role", defaultRoleFor(roles, scope), {
        shouldValidate: form.formState.isSubmitted,
      });
  }

  /** Ganti cara memilih orang: orang yang sudah dipilih atau email yang diketik dibuang. */
  function changeMode(next: PersonMode) {
    setMode(next);
    setChosen(null);
    form.setValue("email", "");
    form.clearErrors("email");
  }

  /** Memilih satu hasil pencarian: emailnya yang dikirim ke backend. */
  function choose(hit: UserHit) {
    setChosen(hit);
    form.setValue("email", hit.email, { shouldValidate: true });
  }

  function close(next: boolean) {
    onOpenChange(next);
  }

  /** Kirim undangan. Berhasil -> toast dan tutup. Gagal -> pesan per field + toast. */
  const submit = form.handleSubmit((values) => {
    setSubmitError("");
    invite.mutate(inviteToApiBody(eventId, values), {
      onSuccess: () => {
        toast.success(`Invitation sent to ${values.email}`);
        close(false);
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
      onOpenChange={close}
      title="Invite member"
      description="Choose where they work, their role, and who they are."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={invite.isPending}>
            {invite.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-5">
        <FormField label="1. Where" error={errors.target?.message}>
          <select
            className={fieldClass}
            value={target}
            aria-invalid={!!errors.target}
            onChange={(e) => changeTarget(e.target.value)}
          >
            <option value="">Choose event team or a competition</option>
            <option value={EVENT_TARGET_VALUE}>Event team</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="2. Role"
          error={errors.role?.message}
          hint={
            target ? undefined : "Choose where first. The roles depend on it."
          }
        >
          <select
            className={fieldClass}
            value={role}
            disabled={!target}
            aria-invalid={!!errors.role}
            onChange={(e) =>
              form.setValue("role", e.target.value, {
                shouldValidate: form.formState.isSubmitted,
              })
            }
          >
            <option value="">Choose a role</option>
            {offeredRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </FormField>

        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-bold">3. Person</legend>
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
            <UserSearchBox
              organizationId={organizationId}
              chosen={chosen}
              onChoose={choose}
              onClear={() => {
                setChosen(null);
                form.setValue("email", "");
              }}
            />
          ) : (
            <FormField
              label="Email"
              required
              hint="We email an invitation. They get access once they accept."
            >
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

        {submitError && (
          <p role="alert" className="text-danger-ink font-semibold">
            {submitError}
          </p>
        )}
      </form>
    </Drawer>
  );
}

/**
 * Kotak cari user: ketik minimal 2 huruf (ditunda 300 ms), maksimal 5 hasil, anggota
 * organisasi event diurutkan duluan oleh server (`organization_id`). Bila sudah ada pilihan,
 * tampil kartu orang terpilih dengan tombol Change.
 */
function UserSearchBox({
  organizationId,
  chosen,
  onChoose,
  onClear,
}: {
  organizationId: string | undefined;
  chosen: UserHit | null;
  onChoose: (hit: UserHit) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query);
  const search = useUserSearch(debounced, organizationId);

  if (chosen)
    return (
      <div className="bg-primary-soft border-primary flex min-h-15 items-center gap-3 rounded-[14px] border-2 px-3.5">
        <span className="text-primary-dark grid size-9 place-items-center rounded-full bg-white text-[13px] font-extrabold">
          {initials(chosen.name, "?")}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="break-words">{chosen.name}</b>
          <span className="text-muted-foreground text-[13px] break-all">
            {chosen.email}
          </span>
        </span>
        <Button variant="secondary" size="sm" onClick={onClear}>
          Change
        </Button>
      </div>
    );

  const items = search.data?.items ?? [];
  const typedEnough = query.trim().length >= USER_SEARCH_MIN_LENGTH;
  const waiting = debounced.trim() !== query.trim() || search.isPending;
  const note = !typedEnough
    ? `Type at least ${USER_SEARCH_MIN_LENGTH} characters.`
    : waiting
      ? "Searching..."
      : `${search.data?.total ?? 0} found, showing ${Math.min(USER_SEARCH_LIMIT, items.length)}.`;

  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5">
        <span className="text-sm font-bold">Name, email or phone</span>
        <span className="border-input focus-within:border-primary flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3">
          <Search size={16} aria-hidden className="text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            placeholder={`At least ${USER_SEARCH_MIN_LENGTH} characters`}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
        </span>
      </label>
      {typedEnough && !waiting && items.length > 0 && (
        <ul
          aria-label="Users found"
          className="border-border overflow-hidden rounded-xl border"
        >
          {items.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onChoose(hit)}
                className="border-muted hover:bg-muted flex min-h-14 w-full items-center gap-3 border-b bg-white px-3.5 text-left last:border-b-0"
              >
                <span
                  aria-hidden
                  className="bg-primary-soft text-primary-dark grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                >
                  {initials(hit.name, "?")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="break-words">{hit.name}</b>
                  <span className="text-muted-foreground text-[13px] break-all">
                    {hit.email}
                  </span>
                </span>
                {hit.isMember && (
                  <span className="bg-primary-soft text-primary-dark rounded-full px-2.5 py-0.5 text-xs font-bold">
                    Member
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.isError && typedEnough && (
        <p role="alert" className="text-danger-ink text-[13px] font-semibold">
          {search.error instanceof Error
            ? search.error.message
            : "Unable to search users."}{" "}
          You can still invite by email.
        </p>
      )}
      <p className="text-muted-foreground text-[13px]" aria-live="polite">
        {note}
      </p>
    </div>
  );
}
