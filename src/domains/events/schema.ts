import { z } from "zod";
import type { ApiEvent, Event } from "./types";

/**
 * Isi form langkah "Event" (wizard New event) dan form Edit event.
 * Semua field berupa string karena berasal dari `<input>`; yang opsional boleh kosong.
 * Tanggal memakai format `<input type="datetime-local">`: "2026-09-04T10:00".
 */
export const eventDetailsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Event name is required.")
      .max(200, "Event name can be at most 200 characters."),
    startAt: z.string().min(1, "Start is required."),
    endAt: z.string().min(1, "End is required."),
    venueName: z.string().trim().max(200, "At most 200 characters."),
    venueAddress: z.string().trim(),
    tagline: z.string().trim().max(255, "At most 255 characters."),
  })
  .refine(
    (v) => !v.startAt || !v.endAt || isEndAfterStart(v.startAt, v.endAt),
    {
      path: ["endAt"],
      message: "End must be after the start.",
    },
  );

export type EventDetailsValues = z.input<typeof eventDetailsSchema>;
export type EventDetails = z.output<typeof eventDetailsSchema>;

export const EMPTY_EVENT_DETAILS: EventDetailsValues = {
  name: "",
  startAt: "",
  endAt: "",
  venueName: "",
  venueAddress: "",
  tagline: "",
};

/** Zona waktu yang dikirim saat MEMBUAT event. Form tidak menanyakannya (sesuai desain); Edit tidak mengubahnya. */
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

/** True bila `end` jatuh setelah `start`. Keduanya format datetime-local, jadi urutan teks = urutan waktu. */
export function isEndAfterStart(start: string, end: string): boolean {
  return end > start;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * ISO dari API -> nilai `datetime-local` di zona waktu browser.
 * Contoh (browser UTC+7): "2026-09-04T03:00:00+00:00" -> "2026-09-04T10:00".
 * Dipanggil saat mengisi form Edit. Tanggal tidak valid menghasilkan "".
 */
export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Nilai `datetime-local` (zona waktu browser) -> ISO UTC untuk API.
 * Contoh (browser UTC+7): "2026-09-04T10:00" -> "2026-09-04T03:00:00.000Z".
 */
export function toIsoString(local: string): string {
  return new Date(local).toISOString();
}

/** Event yang sudah ada -> nilai awal form Edit. */
export function detailsFromEvent(event: Event): EventDetailsValues {
  return {
    name: event.name,
    startAt: toDatetimeLocal(event.startAt),
    endAt: toDatetimeLocal(event.endAt),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    tagline: event.tagline,
  };
}

/** Body `POST /events` dan `PATCH /events/{uuid}` bagian isi event (tanpa organisasi dan zona waktu). */
export type ApiEventDetails = Pick<ApiEvent, "name" | "start_at" | "end_at"> & {
  tagline: string | null;
  venue_name: string | null;
  venue_address: string | null;
};

/**
 * Isi form -> body API. Teks opsional yang kosong dikirim `null` supaya Edit bisa
 * mengosongkan field. Dipakai oleh create dan edit.
 */
export function detailsToApi(details: EventDetails): ApiEventDetails {
  return {
    name: details.name,
    start_at: toIsoString(details.startAt),
    end_at: toIsoString(details.endAt),
    tagline: details.tagline || null,
    venue_name: details.venueName || null,
    venue_address: details.venueAddress || null,
  };
}

/**
 * Inisial untuk kotak avatar event: huruf pertama tiap kata, maksimal 3, huruf besar.
 * "Surabaya Paw Race 2026" -> "SPR". Kata yang diawali angka dilewati. Kosong -> "EV".
 */
export function eventInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .filter((char) => /[A-Za-z]/.test(char))
    .slice(0, 3)
    .join("")
    .toUpperCase();
  return letters || "EV";
}

/** Nama field API -> nama field form, untuk menaruh pesan 422 server di field yang tepat. */
const API_FIELD_TO_FORM: Record<string, keyof EventDetailsValues> = {
  name: "name",
  start_at: "startAt",
  end_at: "endAt",
  venue_name: "venueName",
  venue_address: "venueAddress",
  tagline: "tagline",
};

/**
 * Pesan error 422 dari server (`{ field_api: ["pesan"] }`) -> pesan per field form.
 * Field yang tidak dikenal form (mis. `organization_id`) diabaikan di sini; pemanggil
 * menampilkan pesan umum untuk itu. Dipanggil dari form Event saat simpan gagal.
 */
export function serverErrorsToFormErrors(
  errors: Record<string, string[]> | undefined,
): Partial<Record<keyof EventDetailsValues, string>> {
  const result: Partial<Record<keyof EventDetailsValues, string>> = {};
  for (const [apiField, messages] of Object.entries(errors ?? {})) {
    const formField = API_FIELD_TO_FORM[apiField];
    if (formField && messages.length) result[formField] = messages.join(" ");
  }
  return result;
}
