"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { useUpdateOrganization } from "@/domains/organizations/queries";
import {
  profileSchema,
  profileToApiBody,
  profileToValues,
  serverErrorsToProfileErrors,
  type ProfileInput,
  type ProfileValues,
} from "@/domains/organizations/schema";
import type { OrganizationDetail } from "@/domains/organizations/types";
import { ApiError } from "@/lib/api-client";

const FORM_ID = "edit-organization-form";

/**
 * Drawer kanan "Edit profile" (`PATCH /organizations/{uuid}`). Isian awal dari data organisasi.
 * Hanya OWNER/ADMIN yang melihat tombolnya. Pesan 422 server ditaruh di bawah fieldnya.
 * Dipanggil dari `ProfileTab`; di-remount lewat `key` tiap dibuka.
 */
export function EditProfileDrawer({
  organization,
  open,
  onOpenChange,
}: {
  organization: OrganizationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateOrganization(organization.id);
  const form = useForm<ProfileValues, unknown, ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileToValues(organization),
  });
  const { errors } = form.formState;
  const [submitError, setSubmitError] = useState("");

  const submit = form.handleSubmit((values) => {
    setSubmitError("");
    update.mutate(profileToApiBody(values), {
      onSuccess: () => {
        toast.success("Profile saved");
        onOpenChange(false);
      },
      onError: (cause) => {
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to save the profile.";
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
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      description="These details are shown on the organization page."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <FormField label="Name" required error={errors.name?.message}>
          <input
            className={fieldClass}
            aria-invalid={!!errors.name}
            {...form.register("name")}
          />
        </FormField>
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
        <FormField label="Address" error={errors.address?.message}>
          <input
            className={fieldClass}
            aria-invalid={!!errors.address}
            {...form.register("address")}
          />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <textarea
            rows={4}
            className={`${fieldClass} py-2.5`}
            aria-invalid={!!errors.description}
            {...form.register("description")}
          />
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
