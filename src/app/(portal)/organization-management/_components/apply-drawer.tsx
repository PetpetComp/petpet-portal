"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField, fieldClass } from "@/components/ui/form-field";
import { useSubmitApplication } from "@/domains/organizations/queries";
import {
  EMPTY_APPLICATION_VALUES,
  applicationSchema,
  applicationToApiBody,
  serverErrorsToApplicationErrors,
  type ApplicationInput,
  type ApplicationValues,
} from "@/domains/organizations/schema";
import { ApiError } from "@/lib/api-client";

const FORM_ID = "apply-organizer-form";

/**
 * Drawer kanan "Apply as organizer": form pengajuan jadi organizer (`POST /organizer-applications`).
 * Desain Orgs tidak punya layar ini, jadi memakai pola form di drawer (doc 08 bagian 9.4).
 * Dipanggil dari `MyApplicationSection`. `defaultEmail` mengisi email kontak dengan email akun.
 * Pesan 422 server ditaruh di bawah field yang bersangkutan. Di-remount lewat `key` tiap dibuka.
 */
export function ApplyDrawer({
  open,
  onOpenChange,
  defaultEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail: string;
}) {
  const submitApplication = useSubmitApplication();
  const form = useForm<ApplicationValues, unknown, ApplicationInput>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { ...EMPTY_APPLICATION_VALUES, contactEmail: defaultEmail },
  });
  const { errors } = form.formState;
  const [submitError, setSubmitError] = useState("");

  const submit = form.handleSubmit((values) => {
    setSubmitError("");
    submitApplication.mutate(applicationToApiBody(values), {
      onSuccess: () => {
        toast.success("Application submitted. We will review it soon.");
        onOpenChange(false);
      },
      onError: (cause) => {
        const message =
          cause instanceof Error
            ? cause.message
            : "Unable to submit the application.";
        const fieldErrors =
          cause instanceof ApiError
            ? serverErrorsToApplicationErrors(cause.errors)
            : {};
        for (const [field, text] of Object.entries(fieldErrors))
          form.setError(field as keyof ApplicationValues, { message: text });
        if (Object.keys(fieldErrors).length === 0) setSubmitError(message);
        toast.error(message);
      },
    });
  });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Apply as organizer"
      description="A Petpet administrator reviews your application. Once approved, you become the owner of the organization."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={submitApplication.isPending}
          >
            {submitApplication.isPending
              ? "Submitting..."
              : "Submit application"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <FormField
          label="Organization name"
          required
          error={errors.organizationName?.message}
        >
          <input
            className={fieldClass}
            aria-invalid={!!errors.organizationName}
            {...form.register("organizationName")}
          />
        </FormField>
        <FormField
          label="Contact email"
          required
          error={errors.contactEmail?.message}
        >
          <input
            type="email"
            className={fieldClass}
            aria-invalid={!!errors.contactEmail}
            {...form.register("contactEmail")}
          />
        </FormField>
        <FormField
          label="Organization type"
          hint="For example Community, Club or Association."
          error={errors.organizationType?.message}
        >
          <input
            className={fieldClass}
            aria-invalid={!!errors.organizationType}
            {...form.register("organizationType")}
          />
        </FormField>
        <FormField label="Contact phone" error={errors.contactPhone?.message}>
          <input
            type="tel"
            className={fieldClass}
            aria-invalid={!!errors.contactPhone}
            {...form.register("contactPhone")}
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
