import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import { isHttpUrl } from "@/domains/brands/schema";
import type { ApiBrand } from "@/domains/brands/types";
import { mockAccess } from "./mock-access";
import { forbidUnless } from "./mock-records";
import { nextUuid, paginate, store } from "./mock-store";
import type { MockSponsor, MockUser } from "./mock-types";

/**
 * Backend palsu untuk master sponsor (menu Brands). Aturan mengikuti `SponsorController`,
 * `SponsorService`, dan request validasinya di petpet-service; kontrak lengkap di
 * petpet-docs/_draft-kontrak-brands.md. Dipanggil dari route `/sponsors*` di mock-request.ts.
 *
 * Urutan cek meniru backend: login (401, di mock-request) -> validasi body (422, karena
 * FormRequest jalan sebelum controller) -> izin `master.manage` (403) -> data (404/422).
 */

/** Jumlah baris per halaman bila `per_page` tidak dikirim (bawaan controller backend: 15). */
const DEFAULT_PER_PAGE = "15";

/** Satu PIC brand sebagai response API: nama dan email diambil dari user-nya (`SponsorData`). */
function picRecord(pic: MockSponsor["pics"][number]) {
  const user = store.users.find((item) => item.uuid === pic.user_uuid);
  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    : "";
  return {
    user_uuid: pic.user_uuid,
    name: fullName || pic.name,
    email: user?.email ?? "",
  };
}

/**
 * Satu brand sebagai response API (`SponsorData::toArray`). `campaign` dan `instagram_id`
 * hanya ada di mock: kolomnya ada di tabel, tetapi backend belum mengirimnya.
 */
export function brandRecord(brand: MockSponsor): ApiBrand {
  return {
    uuid: brand.uuid,
    brand_name: brand.brand_name,
    phone: brand.phone ?? null,
    email: brand.email ?? null,
    website_url: brand.website_url ?? null,
    status: brand.status,
    pics: brand.pics.map(picRecord),
    campaign: brand.campaign ?? null,
    instagram_id: brand.instagram_id ?? null,
  };
}

/** Mencari brand berdasarkan uuid; 404 "Sponsor not found." seperti `SponsorNotFoundException`. */
function findBrand(uuid: string): MockSponsor {
  const brand = store.sponsors.find((item) => item.uuid === uuid);
  if (!brand) throw new ApiError(404, "Sponsor not found.");
  return brand;
}

/** Pemanggil harus punya `master.manage` (403 bila tidak). */
function requireMasterManage(user: MockUser) {
  forbidUnless(mockAccess(user).permissions.includes(PERMISSION.MASTER_MANAGE));
}

/** Melempar 422 dengan pesan per field, bentuk sama dengan validasi Laravel. */
function failValidation(errors: Record<string, string[]>): never {
  const first = Object.values(errors)[0]?.[0] ?? "Validation failed.";
  throw new ApiError(422, first, errors);
}

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Validasi body create/edit mengikuti `CreateRequest` dan `UpdateRequest`.
 * `partial` = true untuk PATCH (`brand_name` hanya dicek bila dikirim, aturan `sometimes`).
 * Mengembalikan hanya kolom yang boleh disimpan (seperti `validated()`): field lain dibuang.
 */
export function validateBrandBody(
  body: Record<string, unknown> | undefined,
  partial: boolean,
): Partial<
  Pick<MockSponsor, "brand_name" | "phone" | "email" | "website_url">
> {
  const errors: Record<string, string[]> = {};
  const input = body ?? {};
  const result: Partial<
    Pick<MockSponsor, "brand_name" | "phone" | "email" | "website_url">
  > = {};

  // brand_name: wajib di create; di edit hanya bila dikirim. Teks kosong dianggap tidak ada.
  const hasName = "brand_name" in input;
  if (hasName || !partial) {
    const name = typeof input.brand_name === "string" ? input.brand_name : "";
    if (!name.trim()) {
      errors.brand_name = [
        hasName && partial
          ? "The brand name field must be a string."
          : "The brand name field is required.",
      ];
    } else if (name.length > 200) {
      errors.brand_name = [
        "The brand name field must not be greater than 200 characters.",
      ];
    } else {
      result.brand_name = name.trim();
    }
  }

  // Kolom opsional: kosong/null berarti dikosongkan, selain itu cek panjang dan format.
  const optional = (
    key: "phone" | "email" | "website_url",
    label: string,
    max: number,
    isValid: (value: string) => boolean,
    invalidMessage: string,
  ) => {
    if (!(key in input)) return;
    const raw = input[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      result[key] = undefined;
    } else if (value.length > max) {
      errors[key] = [
        `The ${label} field must not be greater than ${max} characters.`,
      ];
    } else if (!isValid(value)) {
      errors[key] = [invalidMessage];
    } else {
      result[key] = value;
    }
  };
  optional("phone", "phone", 30, () => true, "");
  optional(
    "email",
    "email",
    255,
    isEmail,
    "The email field must be a valid email address.",
  );
  optional(
    "website_url",
    "website url",
    2048,
    isHttpUrl,
    "The website url field must be a valid URL.",
  );

  if (Object.keys(errors).length > 0) failValidation(errors);
  return result;
}

/**
 * `GET /sponsors`: publik. Hanya brand ACTIVE, urut nama (`SponsorRepository::paginate`).
 * `q` (nama, kampanye, handle) hanya ada di mock; backend belum mendukungnya.
 */
export function listBrandRecords(query: URLSearchParams) {
  const term = (query.get("q") ?? "").trim().toLowerCase();
  const matches = (brand: MockSponsor) =>
    !term ||
    [brand.brand_name, brand.campaign ?? "", brand.instagram_id ?? ""].some(
      (text) => text.toLowerCase().includes(term),
    );
  const rows = store.sponsors
    .filter((brand) => brand.status === "ACTIVE" && matches(brand))
    .sort((a, b) => a.brand_name.localeCompare(b.brand_name));
  const paged = new URLSearchParams(query);
  if (!paged.has("per_page")) paged.set("per_page", DEFAULT_PER_PAGE);
  const page = paginate(rows, paged);
  return { ...page, items: page.items.map(brandRecord) };
}

/** `GET /sponsors/{uuid}`: publik, brand INACTIVE tetap bisa dibuka. 404 bila tidak ada. */
export function getBrandRecord(uuid: string): ApiBrand {
  return brandRecord(findBrand(uuid));
}

/** `POST /sponsors`: 422 validasi dulu, lalu 403 tanpa `master.manage`. Status awal ACTIVE. */
export function createBrandRecord(
  user: MockUser,
  body: Record<string, unknown> | undefined,
): ApiBrand {
  const fields = validateBrandBody(body, false);
  requireMasterManage(user);
  const brand: MockSponsor = {
    uuid: nextUuid(),
    brand_name: fields.brand_name ?? "",
    phone: fields.phone,
    email: fields.email,
    website_url: fields.website_url,
    status: "ACTIVE",
    pics: [],
  };
  store.sponsors.push(brand);
  return brandRecord(brand);
}

/** `PATCH /sponsors/{uuid}`: 422 validasi, 403, lalu 404. Hanya kolom yang dikirim yang berubah. */
export function updateBrandRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiBrand {
  const fields = validateBrandBody(body, true);
  requireMasterManage(user);
  const brand = findBrand(uuid);
  const input = body ?? {};
  if (fields.brand_name !== undefined) brand.brand_name = fields.brand_name;
  for (const key of ["phone", "email", "website_url"] as const)
    if (key in input) brand[key] = fields[key];
  return brandRecord(brand);
}

/**
 * `DELETE /sponsors/{uuid}`: menonaktifkan (status INACTIVE), bukan menghapus baris.
 * Urutan: 403, 404, lalu 422 bila sudah nonaktif. Tautan ke event tidak disentuh.
 */
export function deactivateBrandRecord(user: MockUser, uuid: string): ApiBrand {
  requireMasterManage(user);
  const brand = findBrand(uuid);
  if (brand.status === "INACTIVE")
    throw new ApiError(422, "This sponsor is already inactive.");
  brand.status = "INACTIVE";
  return brandRecord(brand);
}

/**
 * `POST /sponsors/{uuid}/pics`: `user_id` wajib dan harus user yang ada (422), lalu 403, lalu 404
 * brand. Response `data: null`. User yang sudah PIC ditolak 422 di mock; backend asli belum
 * mengecek (batasan unik di database akan menjadi galat server), dicatat di doc 09.
 */
export function addBrandPicRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): null {
  const userId = typeof body?.user_id === "string" ? body.user_id : "";
  if (!userId) failValidation({ user_id: ["The user id field is required."] });
  const picUser = store.users.find((item) => item.uuid === userId);
  if (!picUser)
    failValidation({ user_id: ["The selected user id is invalid."] });
  requireMasterManage(user);
  const brand = findBrand(uuid);
  if (brand.pics.some((pic) => pic.user_uuid === userId))
    throw new ApiError(422, "This user is already a PIC of this brand.");
  brand.pics.push({
    uuid: nextUuid(),
    name: picUser?.first_name ?? "",
    user_uuid: userId,
  });
  return null;
}

/** `DELETE /sponsors/{uuid}/pics/{userUuid}`: 403, 404 brand. Tetap sukses bila user bukan PIC. */
export function removeBrandPicRecord(
  user: MockUser,
  uuid: string,
  userUuid: string,
): null {
  requireMasterManage(user);
  const brand = findBrand(uuid);
  brand.pics = brand.pics.filter((pic) => pic.user_uuid !== userUuid);
  return null;
}
