import { z } from "zod";
import type { ApiPetBody, Pet } from "./types";

/**
 * Isi form pet (create dan edit). Semua field berupa string karena berasal dari
 * `<input>`/`<select>`; yang opsional boleh kosong. Aturannya sama dengan validasi
 * `CreatePetRequest` di backend (maks panjang, angka >= 0), supaya galat tampil sebelum request.
 */

/** True bila teks kosong atau angka >= 0 ("38", "12.5"). Dipakai untuk tinggi dan berat. */
function isEmptyOrNonNegative(value: string): boolean {
  if (value === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

/** True bila teks kosong atau tanggal kalender yang ada ("2023-02-30" ditolak). */
export function isEmptyOrValidDate(value: string): boolean {
  if (value === "") return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const petFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Pet name is required.")
    .max(150, "Pet name can be at most 150 characters."),
  speciesId: z.string().min(1, "Species is required."),
  /** Kosong = tanpa morph. */
  morphId: z.string(),
  registrationNumber: z.string().trim().max(100, "At most 100 characters."),
  gender: z.string().trim().max(20, "At most 20 characters."),
  birthDate: z.string().refine(isEmptyOrValidDate, "Enter a valid date."),
  heightCm: z
    .string()
    .trim()
    .refine(isEmptyOrNonNegative, "Enter a number, 0 or more."),
  weightGrams: z
    .string()
    .trim()
    .refine(isEmptyOrNonNegative, "Enter a number, 0 or more."),
  /** Pemilik pilihan staf (uuid user). Kosong = akun pemanggil sendiri. */
  ownerId: z.string(),
});

export type PetFormValues = z.input<typeof petFormSchema>;
export type PetForm = z.output<typeof petFormSchema>;

export const EMPTY_PET_FORM: PetFormValues = {
  name: "",
  speciesId: "",
  morphId: "",
  registrationNumber: "",
  gender: "",
  birthDate: "",
  heightCm: "",
  weightGrams: "",
  ownerId: "",
};

/** Pet yang sudah ada -> nilai awal form Edit. */
export function formFromPet(pet: Pet): PetFormValues {
  return {
    name: pet.name,
    speciesId: pet.speciesId,
    morphId: pet.morphId ?? "",
    registrationNumber: pet.registrationNumber,
    gender: pet.gender,
    birthDate: pet.birthDate,
    heightCm: pet.heightCm === null ? "" : String(pet.heightCm),
    weightGrams: pet.weightGrams === null ? "" : String(pet.weightGrams),
    ownerId: pet.ownerId ?? "",
  };
}

/** Teks angka form -> angka API, atau null bila kosong. Sudah divalidasi skema. */
const numberOrNull = (value: string): number | null =>
  value === "" ? null : Number(value);

/** Opsi isi body: field yang backend asli belum menerimanya (lihat `petFeatures`). */
export type PetBodyOptions = {
  /** Kirim `species_id` dan `morph_id` (create selalu, edit hanya di mock). */
  includeClassification: boolean;
  /** Kirim `owner_id` bila terisi (hanya create oleh staf di mock). */
  includeOwner: boolean;
};

/**
 * Isi form -> body `POST /pets` atau `PATCH /pets/{uuid}`. Teks opsional yang kosong dikirim
 * `null` supaya Edit bisa mengosongkan field. Dipanggil dari `createPet` dan `updatePet`.
 */
export function formToApiBody(
  form: PetForm,
  options: PetBodyOptions,
): ApiPetBody {
  const body: ApiPetBody = {
    name: form.name,
    registration_number: form.registrationNumber || null,
    gender: form.gender || null,
    birth_date: form.birthDate || null,
    height_cm: numberOrNull(form.heightCm),
    weight_grams: numberOrNull(form.weightGrams),
  };
  if (options.includeClassification) {
    body.species_id = form.speciesId;
    body.morph_id = form.morphId || null;
  }
  if (options.includeOwner && form.ownerId) body.owner_id = form.ownerId;
  return body;
}

/** Nama field API -> nama field form, untuk menaruh pesan 422 server di field yang tepat. */
const API_FIELD_TO_FORM: Record<string, keyof PetFormValues> = {
  name: "name",
  species_id: "speciesId",
  morph_id: "morphId",
  registration_number: "registrationNumber",
  gender: "gender",
  birth_date: "birthDate",
  height_cm: "heightCm",
  weight_grams: "weightGrams",
  owner_id: "ownerId",
};

/**
 * Pesan error 422 dari server (`{ field_api: ["pesan"] }`) -> pesan per field form.
 * Field yang tidak dikenal form diabaikan; pemanggil menampilkan pesan umum untuk itu.
 * Dipanggil dari form pet saat simpan gagal.
 */
export function serverErrorsToFormErrors(
  errors: Record<string, string[]> | undefined,
): Partial<Record<keyof PetFormValues, string>> {
  const result: Partial<Record<keyof PetFormValues, string>> = {};
  for (const [apiField, messages] of Object.entries(errors ?? {})) {
    const formField = API_FIELD_TO_FORM[apiField];
    if (formField && messages.length) result[formField] = messages.join(" ");
  }
  return result;
}
