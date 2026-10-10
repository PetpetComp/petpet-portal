import { z } from "zod";
import {
  DEFAULT_TIMEZONE,
  detailsToApi,
  type ApiEventDetails,
  type EventDetails,
} from "./schema";

/**
 * Logika murni wizard New event (tanpa React). Wizard punya 3 langkah:
 * Event -> Organizer & PIC -> Review. Tidak ada yang disimpan ke server
 * sebelum langkah Review dikonfirmasi (docs 08 bagian 9.1).
 */

export const WIZARD_STEPS = ["details", "organizer", "review"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WIZARD_STEP_LABEL: Record<WizardStep, string> = {
  details: "Event",
  organizer: "Organizer & PIC",
  review: "Review",
};

/**
 * Organizer yang dipilih. "new" hanya untuk super admin: organisasi lahir dari
 * pengajuan yang di-approve, jadi pembuatan langsung adalah jalur khusus.
 */
export type OrganizerChoice =
  | { kind: "existing"; id: string; name: string }
  | { kind: "new"; name: string };

/** PIC yang dipilih: user yang sudah punya akun, atau alamat email yang akan diundang. */
export type PicChoice =
  | {
      kind: "user";
      id: string;
      name: string;
      email: string;
      /** True bila anggota organisasi yang dipilih (ditandai server saat mencari). */
      isMember: boolean;
    }
  | { kind: "invite"; email: string };

/** Pesan error per bagian di langkah Organizer & PIC. Kosong berarti boleh lanjut. */
export type OrganizerStepErrors = { organizer?: string; pic?: string };

const emailSchema = z.string().email();

/** True bila `value` berbentuk email yang valid. Dipakai untuk form "Invite by email". */
export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value.trim()).success;
}

/**
 * Cek langkah 2 sebelum lanjut ke Review.
 * Organizer wajib. PIC boleh kosong (OWNER/ADMIN organisasi tetap bisa mengelola event),
 * tetapi kalau memilih "invite" emailnya harus valid.
 */
export function validateOrganizerStep(
  organizer: OrganizerChoice | null,
  pic: PicChoice | null,
): OrganizerStepErrors {
  const errors: OrganizerStepErrors = {};
  if (!organizer) errors.organizer = "Choose the organizer of this event.";
  else if (organizer.kind === "new" && !organizer.name.trim())
    errors.organizer = "Enter the name of the new organization.";
  if (pic?.kind === "invite" && !isValidEmail(pic.email))
    errors.pic = "Enter a valid email address.";
  return errors;
}

export const hasErrors = (errors: OrganizerStepErrors) =>
  Object.keys(errors).length > 0;

/** Body `POST /events`: isi event + (organization_id ATAU new_organization). */
export type ApiCreateEventBody = ApiEventDetails & {
  timezone: string;
  organization_id?: string;
  new_organization?: { name: string };
};

/**
 * Menyusun body `POST /events` dari isi form dan pilihan organizer.
 * Dipanggil dari `createEventWithPic` saat Review dikonfirmasi.
 */
export function buildCreateEventBody(
  details: EventDetails,
  organizer: OrganizerChoice,
): ApiCreateEventBody {
  const base = { ...detailsToApi(details), timezone: DEFAULT_TIMEZONE };
  if (organizer.kind === "existing")
    return { ...base, organization_id: organizer.id };
  return { ...base, new_organization: { name: organizer.name.trim() } };
}

/** Email tujuan undangan EVENT_MANAGER, atau null bila PIC tidak dipilih. */
export function picInvitationEmail(pic: PicChoice | null): string | null {
  if (!pic) return null;
  return pic.kind === "user" ? pic.email : pic.email.trim();
}

/** Nama PIC untuk teks di panel samping dan Review. */
export function picDisplayName(pic: PicChoice | null): string {
  if (!pic) return "No PIC yet";
  return pic.kind === "user" ? pic.name : pic.email.trim();
}

/** Organizer untuk teks di panel samping dan Review. */
export function organizerDisplayName(
  organizer: OrganizerChoice | null,
): string {
  if (!organizer) return "the organizer";
  return organizer.kind === "new"
    ? `${organizer.name.trim()} (new)`
    : organizer.name;
}

/** Hasil `createEventWithPic`: event pasti sudah tersimpan; undangan PIC bisa gagal terpisah. */
export type CreateEventOutcome = {
  eventId: string;
  eventName: string;
  /** Null bila tidak ada undangan atau undangan berhasil. */
  inviteError: string | null;
};
