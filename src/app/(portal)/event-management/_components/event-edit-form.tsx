"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Forbidden } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelEvent,
  useEvent,
  useUpdateEvent,
} from "@/domains/events/queries";
import {
  detailsFromEvent,
  eventDetailsSchema,
  serverErrorsToFormErrors,
  type EventDetails,
  type EventDetailsValues,
} from "@/domains/events/schema";
import type { Event } from "@/domains/events/types";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { EventDetailsFields } from "./event-details-fields";

/**
 * Halaman Edit event (`/event-management/[eventId]/edit`).
 * Memuat event, memeriksa hak (hanya menyembunyikan halaman; backend tetap menegakkan),
 * lalu menampilkan form yang sama dengan langkah "Event" di wizard, sudah terisi.
 * Dipanggil dari `edit/page.tsx`.
 */
export function EventEditPage({ eventId }: { eventId: string }) {
  const event = useEvent(eventId);
  const { canOnEvent } = useAuth();

  if (event.isError)
    return (
      <ErrorState
        error={event.error}
        fallback="Unable to load this event."
        onRetry={() => event.refetch()}
      />
    );
  if (!event.data)
    return (
      <div className="grid max-w-3xl gap-4" aria-busy>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  if (!canOnEvent(event.data, PERMISSION.EVENT_UPDATE)) return <Forbidden />;
  return <EventEditForm event={event.data} />;
}

/** Form Edit yang sudah terisi dari `event`. Hanya dirender setelah event berhasil dimuat. */
function EventEditForm({ event }: { event: Event }) {
  const router = useRouter();
  const { canOnEvent } = useAuth();
  const update = useUpdateEvent(event.id);
  const cancel = useCancelEvent(event.id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const back = ROUTES.eventManagement.detail(event.id);

  const form = useForm<EventDetailsValues, unknown, EventDetails>({
    resolver: zodResolver(eventDetailsSchema),
    defaultValues: detailsFromEvent(event),
  });
  const name = useWatch({ control: form.control, name: "name" });

  /** Simpan perubahan; pesan 422 server dikembalikan ke field-nya, selain itu jadi toast. */
  const save = form.handleSubmit((details) =>
    update.mutate(details, {
      onSuccess: () => {
        toast.success("Event updated");
        router.push(back);
      },
      onError: (cause) => {
        const fieldErrors =
          cause instanceof ApiError
            ? serverErrorsToFormErrors(cause.errors)
            : {};
        if (Object.keys(fieldErrors).length > 0) {
          for (const [field, message] of Object.entries(fieldErrors))
            form.setError(field as keyof EventDetailsValues, { message });
          return;
        }
        toast.error(
          cause instanceof Error ? cause.message : "Unable to save the event.",
        );
      },
    }),
  );

  function cancelEvent() {
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast.success("Event cancelled");
        router.push(back);
      },
      onError: (cause) =>
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Unable to cancel the event.",
        ),
    });
  }

  return (
    <div className="grid max-w-3xl gap-5.5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-2"
      >
        <Link
          href={ROUTES.eventManagement.root}
          className="text-primary font-semibold"
        >
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link href={back} className="text-primary font-semibold">
          {event.name}
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">Edit</span>
      </nav>
      <h1 className="font-display text-[32px] leading-10 font-bold">
        Edit event
      </h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="border-border grid gap-4.5 rounded-2xl border bg-white p-6 sm:grid-cols-2"
      >
        <EventDetailsFields
          register={form.register}
          errors={form.formState.errors}
          name={name ?? ""}
          phase={event.phase}
        />
        <div className="flex justify-between gap-3 pt-1.5 sm:col-span-2">
          <Link
            href={back}
            className="text-primary-dark flex min-h-11 items-center rounded-xl px-4 font-bold"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={update.isPending}
            className="min-h-11 rounded-xl px-5.5 font-bold"
          >
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>

      {event.status !== "CANCELLED" &&
        canOnEvent(event, PERMISSION.EVENT_DELETE) && (
          <section className="border-danger/30 grid gap-3 rounded-2xl border bg-white p-6">
            <b className="text-[17px]">Cancel this event</b>
            <p className="text-muted-foreground">
              A cancelled event stays in the list but can no longer be run. This
              cannot be undone from here.
            </p>
            <div>
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => setConfirmCancel(true)}
              >
                Cancel event
              </Button>
            </div>
          </section>
        )}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel event"
        description={`Cancel "${event.name}"? It stays in the list as Cancelled.`}
        confirmLabel="Cancel event"
        onConfirm={cancelEvent}
      />
    </div>
  );
}
