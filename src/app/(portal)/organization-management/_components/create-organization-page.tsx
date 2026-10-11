"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { PageColumns, SectionCard } from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { canReviewApplications } from "@/domains/organizations/access";
import { useCreateOrganization } from "@/domains/organizations/queries";
import {
  profileSchema,
  profileToApiBody,
  serverErrorsToProfileErrors,
  type ProfileInput,
  type ProfileValues,
} from "@/domains/organizations/schema";
import { useAccessProfile } from "@/domains/organizations/use-organization-rights";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";

const EMPTY_VALUES: ProfileValues = {
  name: "",
  description: "",
  email: "",
  phone: "",
  address: "",
};

/**
 * Halaman "New organization" (`/organization-management/create`), khusus pemegang
 * `organization.verify`. Mengirim `POST /organizations` (USULAN, mock dulu) lalu pindah ke
 * halaman detail organisasi baru. Akun lain hanya melihat penjelasan bahwa organisasi dibuat
 * lewat "Apply as organizer". Dipanggil dari `create/page.tsx`.
 */
export function CreateOrganizationPage() {
  const router = useRouter();
  const allowed = canReviewApplications(useAccessProfile());
  const create = useCreateOrganization();
  const form = useForm<ProfileValues, unknown, ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { errors } = form.formState;
  const [submitError, setSubmitError] = useState("");

  // Simpan: sukses -> ke halaman detail; 422 -> pesan di bawah field; lainnya -> pesan umum.
  const submit = form.handleSubmit((values) => {
    setSubmitError("");
    create.mutate(profileToApiBody(values), {
      onSuccess: (created) => {
        toast.success("Organization created");
        router.push(ROUTES.organizations.detail(created.id));
      },
      onError: (cause) => {
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to create the organization.";
        const fieldErrors =
          cause instanceof ApiError
            ? serverErrorsToProfileErrors(cause.errors)
            : {};
        for (const [field, text] of Object.entries(fieldErrors))
          form.setError(field as keyof ProfileValues, { message: text });
        if (Object.keys(fieldErrors).length === 0) setSubmitError(message);
        toast.error(message);
      },
    });
  });

  return (
    <div className="grid min-w-0 gap-5">
      <Breadcrumb
        items={[
          { label: "Organizations", href: ROUTES.organizationManagement },
          { label: "New organization" },
        ]}
      />
      <header className="grid gap-1.5">
        <h1 className="font-display text-[34px] leading-[38px] font-bold">
          New organization
        </h1>
        <p className="text-muted-foreground text-[15px]">
          Create an organization directly. Add its owner afterwards by inviting
          a member.
        </p>
      </header>

      {!allowed ? (
        <SectionCard title="Not available">
          <p className="text-muted-foreground text-sm">
            Only Petpet administrators can create an organization directly.
            Everyone else can use Apply as organizer on the Organizations page.
          </p>
        </SectionCard>
      ) : (
        <form onSubmit={submit} noValidate>
          <PageColumns
            main={
              <>
                <SectionCard title="General information">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Name"
                      required
                      error={errors.name?.message}
                    >
                      <input
                        className={fieldClass}
                        aria-invalid={!!errors.name}
                        {...form.register("name")}
                      />
                    </FormField>
                    <FormField label="Address" error={errors.address?.message}>
                      <input
                        className={fieldClass}
                        aria-invalid={!!errors.address}
                        {...form.register("address")}
                      />
                    </FormField>
                  </div>
                  <FormField
                    label="Description"
                    error={errors.description?.message}
                  >
                    <textarea
                      rows={4}
                      className={`${fieldClass} py-2.5`}
                      aria-invalid={!!errors.description}
                      {...form.register("description")}
                    />
                  </FormField>
                </SectionCard>
                <SectionCard title="Contact">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Email" error={errors.email?.message}>
                      <input
                        type="email"
                        className={fieldClass}
                        aria-invalid={!!errors.email}
                        {...form.register("email")}
                      />
                    </FormField>
                    <FormField label="Phone" error={errors.phone?.message}>
                      <input
                        type="tel"
                        className={fieldClass}
                        aria-invalid={!!errors.phone}
                        {...form.register("phone")}
                      />
                    </FormField>
                  </div>
                </SectionCard>
              </>
            }
            aside={
              <SectionCard title="Create">
                <p className="text-muted-foreground text-sm">
                  The organization is active right away and has no members yet.
                  Open it afterwards to invite its owner.
                </p>
                {submitError && (
                  <p role="alert" className="text-danger-ink font-semibold">
                    {submitError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Creating..." : "Create organization"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(ROUTES.organizationManagement)}
                  >
                    Cancel
                  </Button>
                </div>
              </SectionCard>
            }
          />
        </form>
      )}
    </div>
  );
}
