"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FormField, fieldClass } from "@/components/ui/form-field";
import {
  reviewNoteSchema,
  type ReviewNoteInput,
  type ReviewNoteValues,
} from "@/domains/organizations/schema";

const FORM_ID = "reject-note-form";

/**
 * Drawer kanan "Reject" dengan satu isian wajib (alasan). Dipakai untuk menolak pengajuan
 * organizer (`review_note`) dan verifikasi organisasi (`rejection_reason`), keduanya wajib di backend.
 * Dipanggil dari `ApplicationQueue` dan `VerificationQueue`. Pemanggil memegang mutation:
 * `onSubmit` menerima alasan, `pending` mengunci tombol. Di-remount lewat `key` tiap dibuka.
 */
export function RejectDrawer({
  open,
  onOpenChange,
  title,
  description,
  label,
  submitLabel,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (note: string) => void;
}) {
  const form = useForm<ReviewNoteValues, unknown, ReviewNoteInput>({
    resolver: zodResolver(reviewNoteSchema),
    defaultValues: { note: "" },
  });
  const error = form.formState.errors.note?.message;
  const submit = form.handleSubmit((values) => onSubmit(values.note));

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="destructive"
            disabled={pending}
          >
            {pending ? "Saving..." : submitLabel}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <FormField label={label} required error={error}>
          <textarea
            rows={5}
            className={`${fieldClass} py-2.5`}
            aria-invalid={!!error}
            {...form.register("note")}
          />
        </FormField>
      </form>
    </Drawer>
  );
}
