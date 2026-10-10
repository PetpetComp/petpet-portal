import { z } from "zod";
import { rolesForScope, scopeOfTarget } from "./roles";
import type {
  ApiStaffInvitationBody,
  AssignmentRole,
  InviteTarget,
} from "./types";

/**
 * Form drawer "Invite member". Semua field string karena berasal dari kontrol form.
 * `target` = "event" (tim event) atau uuid kompetisi. `email` diisi dari orang yang dipilih
 * lewat pencarian, atau diketik langsung pada "Invite by email" (hanya email, kontrak 13 bagian 3).
 */

/** Nilai `target` untuk tim event. Selain ini, nilainya uuid kompetisi. */
export const EVENT_TARGET_VALUE = "event";

/** Nilai form -> target bertipe. */
export function targetFromValue(value: string): InviteTarget {
  return value === EVENT_TARGET_VALUE
    ? { kind: "event" }
    : { kind: "competition", competitionId: value };
}

const emailSchema = z.string().email();

/** True bila `value` (setelah dipangkas) berbentuk email. */
export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value.trim()).success;
}

/**
 * Skema form undang. Dibuat per daftar peran karena aturan "peran harus cocok dengan cakupan
 * target dan aktif" butuh daftar itu. Dipanggil dari drawer; `roles` dari `useAssignmentRoles`.
 */
export function createInviteSchema(roles: AssignmentRole[]) {
  return z
    .object({
      target: z.string().min(1, "Choose where this person will work."),
      role: z.string().min(1, "Choose a role."),
      email: z
        .string()
        .trim()
        .min(1, "Choose a person or enter an email address.")
        .refine(isValidEmail, "Enter a valid email address."),
    })
    .superRefine((values, ctx) => {
      if (!values.target || !values.role) return;
      const offered = rolesForScope(
        roles,
        scopeOfTarget(targetFromValue(values.target)),
      );
      if (!offered.some((r) => r.code === values.role))
        ctx.addIssue({
          code: "custom",
          path: ["role"],
          message: "This role is not available for the chosen target.",
        });
    });
}

export type InviteValues = z.input<ReturnType<typeof createInviteSchema>>;
export type InviteInput = z.output<ReturnType<typeof createInviteSchema>>;

export const EMPTY_INVITE_VALUES: InviteValues = {
  target: "",
  role: "",
  email: "",
};

/** Hasil validasi -> body `POST /staff-invitations`. `competition_id` hanya dikirim untuk kompetisi. */
export function inviteToApiBody(
  eventId: string,
  values: InviteInput,
): ApiStaffInvitationBody {
  const target = targetFromValue(values.target);
  return {
    event_id: eventId,
    ...(target.kind === "competition"
      ? { competition_id: target.competitionId }
      : {}),
    email: values.email.trim(),
    assignment_role: values.role,
  };
}

/** Nama field API -> nama field form. `event_id` tidak punya field (tampil sebagai pesan umum). */
const API_FIELD_TO_FORM: Record<string, keyof InviteValues> = {
  competition_id: "target",
  assignment_role: "role",
  email: "email",
};

/**
 * Pesan 422 server (`{ field_api: ["pesan"] }`) -> pesan per field form.
 * Field yang tidak dikenal diabaikan; pemanggil menampilkan pesan umum dari `ApiError.message`.
 */
export function serverErrorsToInviteErrors(
  errors: Record<string, string[]> | undefined,
): Partial<Record<keyof InviteValues, string>> {
  const result: Partial<Record<keyof InviteValues, string>> = {};
  for (const [apiField, messages] of Object.entries(errors ?? {})) {
    const formField = API_FIELD_TO_FORM[apiField];
    if (formField && messages.length) result[formField] = messages.join(" ");
  }
  return result;
}
