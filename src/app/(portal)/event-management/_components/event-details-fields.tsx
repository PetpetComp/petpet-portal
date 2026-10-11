"use client";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/ui/form-field";
import type { EventDetailsValues } from "@/domains/events/schema";
import type { EventPhase } from "@/domains/events/types";
import { EventAvatar } from "./event-avatar";

type FieldsProps = {
  register: UseFormRegister<EventDetailsValues>;
  errors: FieldErrors<EventDetailsValues>;
};

/** Field nama event. Dipakai wizard (lewat `EventDetailsFields`) dan form Edit. */
export function EventNameField({ register, errors }: FieldsProps) {
  return (
    <FormField
      label="Event name"
      required
      hint="Must be unique."
      error={errors.name?.message}
      className="sm:col-span-2"
    >
      <input
        {...register("name")}
        type="text"
        maxLength={200}
        aria-invalid={!!errors.name}
        className={fieldClass}
      />
    </FormField>
  );
}

/** Field waktu mulai dan selesai (dua field, masing-masing satu sel grid). */
export function EventScheduleFields({ register, errors }: FieldsProps) {
  return (
    <>
      <FormField label="Start" required error={errors.startAt?.message}>
        <input
          {...register("startAt")}
          type="datetime-local"
          aria-invalid={!!errors.startAt}
          className={fieldClass}
        />
      </FormField>
      <FormField label="End" required error={errors.endAt?.message}>
        <input
          {...register("endAt")}
          type="datetime-local"
          aria-invalid={!!errors.endAt}
          className={fieldClass}
        />
      </FormField>
    </>
  );
}

/** Field nama venue. */
export function EventVenueField({ register, errors }: FieldsProps) {
  return (
    <FormField label="Venue" error={errors.venueName?.message}>
      <input
        {...register("venueName")}
        type="text"
        maxLength={200}
        placeholder="e.g. Grand City Convex"
        aria-invalid={!!errors.venueName}
        className={fieldClass}
      />
    </FormField>
  );
}

/** Field slogan (opsional). */
export function EventSloganField({ register, errors }: FieldsProps) {
  return (
    <FormField label="Slogan" error={errors.tagline?.message}>
      <input
        {...register("tagline")}
        type="text"
        maxLength={255}
        placeholder="Optional"
        aria-invalid={!!errors.tagline}
        className={fieldClass}
      />
    </FormField>
  );
}

/** Field alamat venue (selebar baris). */
export function EventAddressField({ register, errors }: FieldsProps) {
  return (
    <FormField
      label="Venue address"
      error={errors.venueAddress?.message}
      className="sm:col-span-2"
    >
      <input
        {...register("venueAddress")}
        type="text"
        placeholder="Street, city"
        aria-invalid={!!errors.venueAddress}
        className={fieldClass}
      />
    </FormField>
  );
}

/** Kotak foto event (upload belum tersedia, tampil inisial). `name` untuk inisial, `phase` untuk warna. */
export function EventPhotoField({
  name,
  phase,
}: {
  name: string;
  phase: EventPhase | null;
}) {
  return (
    <div className="border-lilac-300 flex flex-wrap items-center gap-4 rounded-[14px] border-[1.5px] border-dashed p-4 sm:col-span-2">
      <EventAvatar name={name || "Event"} phase={phase} size="lg" />
      <span className="flex min-w-0 flex-1 basis-48 flex-col">
        <b>Event photo</b>
        <span className="text-muted-foreground text-[13px]">
          Photo upload is not available yet. Until then we show the initials.
        </span>
      </span>
      <Button
        variant="secondary"
        disabled
        title="Photo upload is not available yet"
        className="min-h-11 rounded-xl"
      >
        Upload
      </Button>
    </div>
  );
}

/**
 * Kolom isian event: nama, jadwal, venue, slogan, dan kotak foto, dalam satu grid.
 * Dipakai oleh langkah "Event" di wizard New event. Form Edit memakai bagian-bagiannya
 * (di atas) yang dikelompokkan per kartu. Form dimiliki pemanggil (react-hook-form);
 * komponen ini hanya menggambar. `name` untuk inisial foto, `phase` untuk warnanya.
 */
export function EventDetailsFields({
  register,
  errors,
  name,
  phase,
}: FieldsProps & {
  name: string;
  phase: EventPhase | null;
}) {
  return (
    <>
      <EventNameField register={register} errors={errors} />
      <EventScheduleFields register={register} errors={errors} />
      <EventVenueField register={register} errors={errors} />
      <EventSloganField register={register} errors={errors} />
      <EventAddressField register={register} errors={errors} />
      <EventPhotoField name={name} phase={phase} />
    </>
  );
}
