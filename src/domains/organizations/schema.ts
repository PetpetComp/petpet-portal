import { z } from "zod";
import {
  INVITABLE_ROLES,
  type ApiOrganizationInvitationBody,
  type ApiOrganizationUpdateBody,
  type ApiOrganizerApplicationBody,
  type OrganizationDetail,
} from "./types";

/**
 * Skema form domain Organizations (react-hook-form + zod). Semua field string karena berasal
 * dari kontrol form. Batas panjang mengikuti validasi backend (`app/Http/Requests/Organization`).
 */

const EMAIL_MESSAGE = "Enter a valid email address.";

/** True bila `value` berbentuk email. */
function looksLikeEmail(value: string): boolean {
  return z.string().email().safeParse(value).success;
}

// ---------------------------------------------------------------------------
// Form "Apply as organizer" (POST /organizer-applications)
// ---------------------------------------------------------------------------

export const applicationSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Enter the organization name.")
    .max(200, "Use at most 200 characters."),
  contactEmail: z
    .string()
    .trim()
    .min(1, "Enter a contact email.")
    .max(255, "Use at most 255 characters.")
    .refine(looksLikeEmail, EMAIL_MESSAGE),
  organizationType: z.string().trim().max(50, "Use at most 50 characters."),
  description: z.string().trim(),
  contactPhone: z.string().trim().max(30, "Use at most 30 characters."),
  address: z.string().trim(),
});

export type ApplicationValues = z.input<typeof applicationSchema>;
export type ApplicationInput = z.output<typeof applicationSchema>;

export const EMPTY_APPLICATION_VALUES: ApplicationValues = {
  organizationName: "",
  contactEmail: "",
  organizationType: "",
  description: "",
  contactPhone: "",
  address: "",
};

/** Form -> body API. Field opsional yang kosong tidak ikut terkirim. */
export function applicationToApiBody(
  values: ApplicationInput,
): ApiOrganizerApplicationBody {
  return {
    proposed_organization_name: values.organizationName,
    contact_email: values.contactEmail,
    ...(values.organizationType
      ? { organization_type: values.organizationType }
      : {}),
    ...(values.description ? { description: values.description } : {}),
    ...(values.contactPhone ? { contact_phone: values.contactPhone } : {}),
    ...(values.address ? { address: values.address } : {}),
  };
}

/** Nama field API -> nama field form (untuk pesan 422 dari server). */
const APPLICATION_API_FIELD: Record<string, keyof ApplicationValues> = {
  proposed_organization_name: "organizationName",
  contact_email: "contactEmail",
  organization_type: "organizationType",
  description: "description",
  contact_phone: "contactPhone",
  address: "address",
};

// ---------------------------------------------------------------------------
// Form Edit profil organisasi (PATCH /organizations/{uuid})
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the organization name.")
    .max(200, "Use at most 200 characters."),
  description: z.string().trim(),
  /** Email opsional: kosong boleh, bila terisi harus berbentuk email. */
  email: z
    .string()
    .trim()
    .max(255, "Use at most 255 characters.")
    .refine((v) => v === "" || looksLikeEmail(v), EMAIL_MESSAGE),
  phone: z.string().trim().max(30, "Use at most 30 characters."),
  address: z.string().trim(),
});

export type ProfileValues = z.input<typeof profileSchema>;
export type ProfileInput = z.output<typeof profileSchema>;

/** Organisasi -> nilai awal form Edit. */
export function profileToValues(org: OrganizationDetail): ProfileValues {
  return {
    name: org.name,
    description: org.description,
    email: org.email,
    phone: org.phone,
    address: org.address,
  };
}

/** Form -> body `PATCH`. Field opsional yang dikosongkan dikirim `null` (hapus nilainya). */
export function profileToApiBody(
  values: ProfileInput,
): ApiOrganizationUpdateBody {
  return {
    name: values.name,
    description: values.description || null,
    email: values.email || null,
    phone: values.phone || null,
    address: values.address || null,
  };
}

const PROFILE_API_FIELD: Record<string, keyof ProfileValues> = {
  name: "name",
  description: "description",
  email: "email",
  phone: "phone",
  address: "address",
};

// ---------------------------------------------------------------------------
// Form "Invite member" (POST /organizations/{uuid}/invitations)
// ---------------------------------------------------------------------------

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Choose a person or enter an email address.")
    .max(255, "Use at most 255 characters.")
    .refine(looksLikeEmail, EMAIL_MESSAGE),
  role: z.enum(INVITABLE_ROLES, { message: "Choose a role." }),
});

export type InviteValues = z.input<typeof inviteSchema>;
export type InviteInput = z.output<typeof inviteSchema>;

export const EMPTY_INVITE_VALUES: InviteValues = { email: "", role: "STAFF" };

/** Form -> body undangan. */
export function inviteToApiBody(
  values: InviteInput,
): ApiOrganizationInvitationBody {
  return { email: values.email, member_role: values.role };
}

const INVITE_API_FIELD: Record<string, keyof InviteValues> = {
  email: "email",
  member_role: "role",
};

// ---------------------------------------------------------------------------
// Catatan penolakan (reject pengajuan atau verifikasi)
// ---------------------------------------------------------------------------

/** Alasan wajib, maks 1000 huruf (backend `review_note` dan `rejection_reason`). */
export const reviewNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Write a short reason so the applicant knows what to fix.")
    .max(1000, "Use at most 1000 characters."),
});

export type ReviewNoteValues = z.input<typeof reviewNoteSchema>;
export type ReviewNoteInput = z.output<typeof reviewNoteSchema>;

// ---------------------------------------------------------------------------
// Pesan 422 server -> pesan per field form
// ---------------------------------------------------------------------------

/**
 * Pesan 422 server (`{ field_api: ["pesan"] }`) -> pesan per field form lewat tabel
 * pemetaan nama field. Field yang tidak dikenal diabaikan; pemanggil menampilkan
 * pesan umum dari `ApiError.message`.
 */
function mapServerErrors<F extends string>(
  errors: Record<string, string[]> | undefined,
  fieldMap: Record<string, F>,
): Partial<Record<F, string>> {
  const result: Partial<Record<F, string>> = {};
  for (const [apiField, messages] of Object.entries(errors ?? {})) {
    const formField = fieldMap[apiField];
    if (formField && messages.length) result[formField] = messages.join(" ");
  }
  return result;
}

export const serverErrorsToApplicationErrors = (
  errors: Record<string, string[]> | undefined,
) => mapServerErrors(errors, APPLICATION_API_FIELD);

export const serverErrorsToProfileErrors = (
  errors: Record<string, string[]> | undefined,
) => mapServerErrors(errors, PROFILE_API_FIELD);

export const serverErrorsToInviteErrors = (
  errors: Record<string, string[]> | undefined,
) => mapServerErrors(errors, INVITE_API_FIELD);
