import { z } from "zod";
import { DEFAULT_ROLE, GENDERS, type Gender, type User } from "./types";

/**
 * Form New user dan Edit user (desain UserForm). Semua field string karena berasal dari
 * kontrol form. Dipakai oleh `UserForm` lewat react-hook-form + zodResolver.
 * Username dan email hanya bisa diisi saat membuat user: backend tidak menerimanya di PATCH.
 */

/** Phone di desain: hanya angka, 8 sampai 15 digit. */
const PHONE_PATTERN = /^\d{8,15}$/;
export const PHONE_MESSAGE = "Numbers only, 8-15 digits.";

/** Mode form: `create` memvalidasi username dan email, `edit` membiarkannya apa adanya. */
export type UserFormMode = "create" | "edit";

/**
 * Membuat skema form untuk satu mode. Dipanggil dari `UserForm` (satu kali per render mode).
 * Mode `edit` tidak memvalidasi username/email karena kontrolnya dikunci (read-only).
 */
export function createUserFormSchema(mode: UserFormMode) {
  const creating = mode === "create";
  return z.object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(100, "At most 100 characters."),
    lastName: z.string().trim().max(100, "At most 100 characters."),
    username: creating
      ? z
          .string()
          .trim()
          .min(1, "Username is required.")
          .max(100, "At most 100 characters.")
          .regex(/^\S+$/, "Username cannot contain spaces.")
      : z.string(),
    gender: z.union([z.literal(""), z.enum(GENDERS)]),
    email: creating
      ? z
          .string()
          .trim()
          .min(1, "Email is required.")
          .max(255, "At most 255 characters.")
          .email("Enter a valid email address.")
      : z.string(),
    phone: z
      .string()
      .trim()
      .min(1, "Phone is required.")
      .regex(PHONE_PATTERN, PHONE_MESSAGE),
    province: z.string().trim().max(100, "At most 100 characters."),
    city: z.string().trim().max(100, "At most 100 characters."),
    roles: z.array(z.string()),
  });
}

export type UserFormValues = z.input<ReturnType<typeof createUserFormSchema>>;
export type UserFormInput = z.output<ReturnType<typeof createUserFormSchema>>;

/** Nilai awal form New user: kotak role "User" tercentang (desain). */
export const EMPTY_USER_FORM: UserFormValues = {
  firstName: "",
  lastName: "",
  username: "",
  gender: "",
  email: "",
  phone: "",
  province: "",
  city: "",
  roles: [DEFAULT_ROLE],
};

/** User yang sudah ada -> nilai awal form Edit. Role tidak diedit di form (ada di halaman detail). */
export function formValuesFromUser(user: User): UserFormValues {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    gender: user.gender,
    email: user.email,
    phone: user.phone,
    province: user.province,
    city: user.city,
    roles: user.roles.map((r) => r.code),
  };
}

/** Body `POST /users` (hanya field yang diterima backend sekarang). Nama belakang kosong dihilangkan. */
export type CreateUserBody = {
  username: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone: string;
  roles: string[];
};

export function toCreateBody(input: UserFormInput): CreateUserBody {
  return {
    username: input.username,
    email: input.email,
    first_name: input.firstName,
    ...(input.lastName ? { last_name: input.lastName } : {}),
    phone: input.phone,
    roles: input.roles,
  };
}

/**
 * Body `PATCH /users/{uuid}` untuk profil. Teks kosong dikirim `null` supaya isian yang
 * dihapus benar-benar terhapus di server. Dipakai oleh edit dan oleh langkah kedua create.
 */
export type ProfileBody = {
  gender: Gender | null;
  province: string | null;
  city: string | null;
};

export function toProfileBody(input: UserFormInput): ProfileBody {
  return {
    gender: input.gender || null,
    province: input.province || null,
    city: input.city || null,
  };
}

/** True bila ada isian profil yang perlu dikirim lewat PATCH setelah user dibuat. */
export function hasProfileInput(input: UserFormInput): boolean {
  return Boolean(input.gender || input.province || input.city);
}

export type UpdateUserBody = ProfileBody & {
  first_name: string;
  last_name: string | null;
  phone: string;
};

/** Body edit lengkap: nama, telepon, dan profil. */
export function toUpdateBody(input: UserFormInput): UpdateUserBody {
  return {
    first_name: input.firstName,
    last_name: input.lastName || null,
    phone: input.phone,
    ...toProfileBody(input),
  };
}

/** Nama field API -> nama field form, untuk menaruh pesan 422 server di bawah field-nya. */
const API_FIELD_TO_FORM: Record<string, keyof UserFormValues> = {
  first_name: "firstName",
  last_name: "lastName",
  username: "username",
  email: "email",
  phone: "phone",
  gender: "gender",
  province: "province",
  city: "city",
  roles: "roles",
};

/**
 * Error 422 backend (`{ field: [pesan] }`) -> error per field form. Field tak dikenal
 * (mis. `roles.0`) dipetakan ke induknya bila bisa; yang lain diabaikan dan pemanggil
 * menampilkan pesan umum.
 */
export function serverErrorsToFormErrors(
  errors: Record<string, string[]> | undefined,
): Partial<Record<keyof UserFormValues, string>> {
  const result: Partial<Record<keyof UserFormValues, string>> = {};
  for (const [apiField, messages] of Object.entries(errors ?? {})) {
    const root = apiField.split(".")[0];
    const formField = API_FIELD_TO_FORM[root];
    if (formField && messages.length) result[formField] = messages.join(" ");
  }
  return result;
}
