import { z } from "zod";
import type { Brand } from "./types";

/**
 * Skema form brand (create dan edit) dan terjemahan form <-> body API.
 * Batas panjang mengikuti `CreateRequest`/`UpdateRequest` backend: brand_name wajib max 200,
 * phone max 30, email valid max 255, website_url berupa URL max 2048. Hanya kolom yang
 * memang diterima backend; media sosial dan logo belum ada di API (lihat draf kontrak).
 */

const emailSchema = z.string().email();

/** True bila `value` URL http/https yang valid. Backend memakai aturan `url`; kita lebih ketat ke http(s). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const brandSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "Brand name is required.")
    .max(200, "Brand name can be at most 200 characters."),
  phone: z.string().trim().max(30, "Phone can be at most 30 characters."),
  email: z
    .string()
    .trim()
    .max(255, "Email can be at most 255 characters.")
    .refine(
      (value) => value === "" || emailSchema.safeParse(value).success,
      "Enter a valid email address.",
    ),
  websiteUrl: z
    .string()
    .trim()
    .max(2048, "Website can be at most 2048 characters.")
    .refine(
      (value) => value === "" || isHttpUrl(value),
      "Enter a full web address, e.g. https://example.com.",
    ),
});

/** Isi form (semua string, karena berasal dari `<input>`). */
export type BrandFormValues = z.input<typeof brandSchema>;
/** Isi form setelah divalidasi dan dirapikan (spasi pinggir dibuang). */
export type BrandDetails = z.output<typeof brandSchema>;

export const EMPTY_BRAND_FORM: BrandFormValues = {
  brandName: "",
  phone: "",
  email: "",
  websiteUrl: "",
};

/** Brand yang sudah ada -> nilai awal form Edit. Kolom kosong (null) menjadi string kosong. */
export function formFromBrand(brand: Brand): BrandFormValues {
  return {
    brandName: brand.name,
    phone: brand.phone ?? "",
    email: brand.email ?? "",
    websiteUrl: brand.websiteUrl ?? "",
  };
}

/** Body `POST /sponsors` dan `PATCH /sponsors/{uuid}` (kolom backend saja). */
export type ApiBrandBody = {
  brand_name: string;
  phone: string | null;
  email: string | null;
  website_url: string | null;
};

/**
 * Isi form -> body API. Teks opsional yang kosong dikirim `null` supaya Edit bisa
 * mengosongkan kolom (backend menerima `nullable`). Dipanggil dari api.ts untuk create dan edit.
 */
export function brandToBody(details: BrandDetails): ApiBrandBody {
  return {
    brand_name: details.brandName,
    phone: details.phone || null,
    email: details.email || null,
    website_url: details.websiteUrl || null,
  };
}

/** Nama field API -> nama field form, untuk menaruh pesan 422 server di field yang tepat. */
const API_FIELD_TO_FORM: Record<string, keyof BrandFormValues> = {
  brand_name: "brandName",
  phone: "phone",
  email: "email",
  website_url: "websiteUrl",
};

/**
 * Pesan error 422 dari server (`{ field_api: ["pesan"] }`) -> pesan per field form.
 * Field yang tidak dikenal form diabaikan; pemanggil menampilkan pesan umum untuk itu.
 * Dipanggil dari form Brand saat simpan gagal.
 */
export function serverErrorsToFormErrors(
  errors: Record<string, string[]> | undefined,
): Partial<Record<keyof BrandFormValues, string>> {
  const result: Partial<Record<keyof BrandFormValues, string>> = {};
  for (const [apiField, messages] of Object.entries(errors ?? {})) {
    const formField = API_FIELD_TO_FORM[apiField];
    if (formField && messages.length) result[formField] = messages.join(" ");
  }
  return result;
}
