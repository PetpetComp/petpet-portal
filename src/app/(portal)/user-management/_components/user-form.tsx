"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { PageColumns, SectionCard } from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EMPTY_USER_FORM,
  createUserFormSchema,
  formValuesFromUser,
  serverErrorsToFormErrors,
  type UserFormInput,
  type UserFormMode,
  type UserFormValues,
} from "@/domains/users/schema";
import {
  useCreateUser,
  useRoles,
  useUpdateUser,
  useUser,
} from "@/domains/users/queries";
import { assignableRoles, sortRoles } from "@/domains/users/roles";
import { GENDERS, GENDER_LABEL, type User } from "@/domains/users/types";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { RegionFields } from "./region-fields";
import { UserAvatar } from "./user-avatar";
import { UserStatusBadge } from "./user-status-badge";

/** Skema per mode dibuat sekali di luar komponen supaya tidak berganti identitas tiap render. */
const SCHEMAS = {
  create: createUserFormSchema("create"),
  edit: createUserFormSchema("edit"),
};

/** Grid field di dalam kartu: satu kolom di HP, dua kolom mulai layar sm. */
const FIELD_GRID = "grid gap-4 sm:grid-cols-2";

/** Halaman New user (`/user-management/create`). Dipanggil dari `create/page.tsx`. */
export function UserCreatePage() {
  return (
    <RequirePermission permission={PERMISSION.USER_MANAGE}>
      <UserForm mode="create" />
    </RequirePermission>
  );
}

/**
 * Halaman Edit user (`/user-management/[userId]/edit`). Memuat user, lalu menampilkan form
 * yang sama dengan New user, sudah terisi. Dipanggil dari `edit/page.tsx`.
 */
export function UserEditPage({ userId }: { userId: string }) {
  const user = useUser(userId);
  return (
    <RequirePermission permission={PERMISSION.USER_MANAGE}>
      {user.isError ? (
        <ErrorState
          error={user.error}
          fallback="Unable to load this user."
          onRetry={() => user.refetch()}
        />
      ) : !user.data ? (
        <div className="grid gap-4" aria-busy>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <UserForm mode="edit" user={user.data} />
      )}
    </RequirePermission>
  );
}

/**
 * Form New user / Edit user selebar konten (PageColumns): kolom utama berisi kartu Identity,
 * Contact, Location dan (hanya saat membuat) Platform roles; kolom samping berisi ringkasan
 * dan tombol simpan. Username dan email dikunci saat edit karena backend tidak menerimanya
 * di PATCH. Tidak ada kecamatan. Validasi zod; pesan 422 server ditaruh di bawah fieldnya,
 * selain itu jadi toast.
 */
function UserForm({ mode, user }: { mode: UserFormMode; user?: User }) {
  const router = useRouter();
  const { hasRole } = useAuth();
  const create = useCreateUser();
  const update = useUpdateUser(user?.id ?? "");
  const roles = useRoles();
  const editing = mode === "edit";
  const saving = create.isPending || update.isPending;

  const form = useForm<UserFormValues, unknown, UserFormInput>({
    resolver: zodResolver(SCHEMAS[mode]),
    defaultValues: user ? formValuesFromUser(user) : EMPTY_USER_FORM,
  });
  const { register, control, setValue, formState } = form;
  const errors = formState.errors;
  const province = useWatch({ control, name: "province" }) ?? "";
  const city = useWatch({ control, name: "city" }) ?? "";
  const firstName = useWatch({ control, name: "firstName" }) ?? "";
  const lastName = useWatch({ control, name: "lastName" }) ?? "";
  const backHref = user ? ROUTES.users.detail(user.id) : ROUTES.userManagement;

  // Ringkasan di kolom samping mengikuti ketikan nama (avatar inisial + nama).
  const summaryName = `${firstName} ${lastName}`.trim();
  const summaryInitials = (
    firstName.trim().charAt(0) + lastName.trim().charAt(0)
  ).toUpperCase();

  /** Pesan 422 server ke field-nya; bila tak ada yang cocok, toast umum. */
  function showError(cause: unknown, fallback: string) {
    const fieldErrors =
      cause instanceof ApiError ? serverErrorsToFormErrors(cause.errors) : {};
    if (Object.keys(fieldErrors).length > 0) {
      for (const [field, message] of Object.entries(fieldErrors))
        form.setError(field as keyof UserFormValues, { message });
      return;
    }
    toast.error(cause instanceof Error ? cause.message : fallback);
  }

  const save = form.handleSubmit((input) => {
    if (editing) {
      update.mutate(input, {
        onSuccess: () => {
          toast.success("User updated");
          router.push(backHref);
        },
        onError: (cause) => showError(cause, "Unable to save the user."),
      });
      return;
    }
    create.mutate(input, {
      onSuccess: ({ user: created, profileError }) => {
        toast.success("User created");
        if (profileError)
          toast.warning(
            `The address details were not saved (${profileError}). Open Edit to add them.`,
          );
        router.push(ROUTES.users.detail(created.id));
      },
      onError: (cause) => showError(cause, "Unable to create the user."),
    });
  });

  const offeredRoles = assignableRoles(
    sortRoles(roles.data ?? []),
    hasRole("SUPER_ADMIN"),
  );

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
        {user && (
          <>
            <Link href={backHref} className="text-primary font-semibold">
              {user.name}
            </Link>
            <ChevronRight size={14} aria-hidden />
          </>
        )}
        <span className="text-foreground font-semibold">
          {editing ? "Edit" : "New user"}
        </span>
      </nav>
      <h1 className="font-display text-[32px] leading-10 font-bold">
        {editing ? "Edit user" : "New user"}
      </h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <PageColumns
          main={
            <>
              <SectionCard
                title="Identity"
                description="How the person is named on the platform."
              >
                <div className={FIELD_GRID}>
                  <FormField
                    label="First name"
                    required
                    error={errors.firstName?.message}
                  >
                    <input
                      {...register("firstName")}
                      type="text"
                      maxLength={100}
                      aria-invalid={!!errors.firstName}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField label="Last name" error={errors.lastName?.message}>
                    <input
                      {...register("lastName")}
                      type="text"
                      maxLength={100}
                      aria-invalid={!!errors.lastName}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField
                    label="Username"
                    required={!editing}
                    hint={editing ? "Username cannot be changed." : undefined}
                    error={errors.username?.message}
                  >
                    <input
                      {...register("username")}
                      type="text"
                      maxLength={100}
                      disabled={editing}
                      aria-invalid={!!errors.username}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField label="Gender" error={errors.gender?.message}>
                    <select {...register("gender")} className={fieldClass}>
                      <option value="">Not set</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {GENDER_LABEL[g]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard
                title="Contact"
                description="Used for sign in and notifications."
              >
                <div className={FIELD_GRID}>
                  <FormField
                    label="Email"
                    required={!editing}
                    hint={editing ? "Email cannot be changed." : undefined}
                    error={errors.email?.message}
                  >
                    <input
                      {...register("email")}
                      type="email"
                      maxLength={255}
                      disabled={editing}
                      aria-invalid={!!errors.email}
                      className={fieldClass}
                    />
                  </FormField>
                  <FormField
                    label="Phone"
                    required
                    error={errors.phone?.message}
                  >
                    <input
                      {...register("phone")}
                      type="tel"
                      inputMode="numeric"
                      aria-invalid={!!errors.phone}
                      className={cn(fieldClass, errors.phone && "border-2")}
                    />
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard title="Location">
                <div className={FIELD_GRID}>
                  <RegionFields
                    control={control}
                    errors={errors}
                    setValue={setValue}
                    province={province}
                    city={city}
                  />
                </div>
              </SectionCard>

              {!editing && (
                <SectionCard
                  title="Platform roles"
                  description="Global permissions. Org roles are set on the organization; event duties come from assignments."
                >
                  <div className="flex flex-wrap gap-2.5">
                    {roles.isPending && (
                      <Skeleton className="h-11 w-64 rounded-xl" />
                    )}
                    {roles.isError && (
                      <p role="alert" className="text-danger-ink text-[13px]">
                        Unable to load roles. The user will be created with no
                        role.
                      </p>
                    )}
                    <Controller
                      control={control}
                      name="roles"
                      render={({ field }) => (
                        <>
                          {offeredRoles.map((role) => {
                            const checked = field.value.includes(role.code);
                            return (
                              <label
                                key={role.code}
                                className={cn(
                                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5",
                                  checked
                                    ? "border-primary bg-primary-soft border-2 font-bold"
                                    : "border-input",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    field.onChange(
                                      checked
                                        ? field.value.filter(
                                            (c) => c !== role.code,
                                          )
                                        : [...field.value, role.code],
                                    )
                                  }
                                  className="accent-primary size-4.5"
                                />
                                {role.name}
                              </label>
                            );
                          })}
                        </>
                      )}
                    />
                  </div>
                  <p className="text-muted-foreground text-[13px]">
                    See{" "}
                    <Link
                      href={ROUTES.rolesAccess}
                      className="text-primary font-bold"
                    >
                      Roles &amp; access
                    </Link>{" "}
                    for what each role can do.
                  </p>
                  {errors.roles?.message && (
                    <span
                      role="alert"
                      className="text-danger-ink text-[13px] font-semibold"
                    >
                      {errors.roles.message}
                    </span>
                  )}
                </SectionCard>
              )}
            </>
          }
          aside={
            <>
              <SectionCard>
                <div className="flex min-w-0 items-center gap-4">
                  <UserAvatar initials={summaryInitials || "?"} size="lg" />
                  <div className="grid min-w-0 gap-1">
                    <span className="truncate font-bold">
                      {summaryName || "New user"}
                    </span>
                    {user && (
                      <span className="text-muted-foreground truncate text-sm">
                        @{user.username}
                      </span>
                    )}
                    {user && <UserStatusBadge status={user.status} />}
                  </div>
                </div>
                {editing && (
                  <p className="text-muted-foreground text-[13px]">
                    Platform roles are changed on the{" "}
                    <Link
                      href={backHref}
                      className="text-primary-dark font-bold underline"
                    >
                      user page
                    </Link>
                    .
                  </p>
                )}
              </SectionCard>

              <SectionCard>
                <Button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 w-full rounded-xl px-5.5 font-bold"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save changes"
                      : "Create user"}
                </Button>
                <Link
                  href={backHref}
                  className="text-primary-dark flex min-h-11 items-center justify-center rounded-xl px-4 font-bold"
                >
                  Cancel
                </Link>
              </SectionCard>
            </>
          }
        />
      </form>
    </div>
  );
}
