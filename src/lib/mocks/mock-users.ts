import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  GENDERS,
  USER_SORTS,
  USER_STATUSES,
  type ApiCity,
  type ApiCountry,
  type ApiProvince,
  type ApiRole,
  type ApiPermissionsByModule,
  type ApiUser,
} from "@/domains/users/types";
import { mockAccess, roleCodesOf } from "./mock-access";
import {
  ALL_PERMISSION_CODES,
  findMockRole,
  permissionRecords,
  roleRecords,
} from "./mock-roles";
import { nextUuid, paginate, store } from "./mock-store";
import type { MockUser } from "./mock-types";

/**
 * Backend palsu untuk Users, Roles dan wilayah (provinsi/kota) di form user.
 * Bentuk response dan aturan 403/422 mengikuti petpet-service: `UserController`,
 * `UserService`, `UserData`, `RoleController`, `PermissionController`, `MasterController`
 * dan form request di `app/Http/Requests/User/User`. Kontrak lengkap: doc 13 (bagian Users).
 *
 * Urutan cek meniru backend: validasi isi (form request, 422) dijalankan LEBIH DULU,
 * lalu permission (403), lalu data (404, aturan super admin).
 */

const FORBIDDEN_MESSAGE = "You don't have permission to perform this action.";
const SUPER_ADMIN_CODE = "SUPER_ADMIN";
/** Batas `per_page` di `ListRequest` backend (1..100) dan bawaannya. */
const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 15;

/* ------------------------------------------------------------------ */
/* Data contoh profil (kota, provinsi, gender) untuk user seed          */
/* ------------------------------------------------------------------ */

type ProfileSeed = { gender: string; city: string; province: string };

/** Profil contoh per username. User yang tidak ada di sini punya profil kosong. */
const PROFILE_SEED: Record<string, ProfileSeed> = {
  admin: { gender: "MALE", city: "Jakarta Selatan", province: "DKI Jakarta" },
  organizer: { gender: "FEMALE", city: "Surabaya", province: "Jawa Timur" },
  competitor: { gender: "MALE", city: "Bandung", province: "Jawa Barat" },
  sponsor: { gender: "FEMALE", city: "Depok", province: "Jawa Barat" },
  "dian.kusuma": { gender: "FEMALE", city: "Tangerang", province: "Banten" },
  "bima.saputra": { gender: "MALE", city: "Bekasi", province: "Jawa Barat" },
  "sari.wulandari": { gender: "FEMALE", city: "Bogor", province: "Jawa Barat" },
  "rangga.putra": { gender: "MALE", city: "Semarang", province: "Jawa Tengah" },
  "citra.ayu": { gender: "FEMALE", city: "Surabaya", province: "Jawa Timur" },
  "farhan.hidayat": {
    gender: "MALE",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
  },
  "alya.maulana": { gender: "FEMALE", city: "Malang", province: "Jawa Timur" },
  "bagas.hakim": { gender: "MALE", city: "Bandung", province: "Jawa Barat" },
  "citra.lestari": {
    gender: "FEMALE",
    city: "Denpasar",
    province: "Bali",
  },
  "damar.prakoso": { gender: "MALE", city: "Depok", province: "Jawa Barat" },
  "eka.saputra": { gender: "MALE", city: "Surakarta", province: "Jawa Tengah" },
  "gita.rahma": {
    gender: "FEMALE",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
  },
};

/** Profil yang berlaku untuk satu user: isian hasil edit, atau data contoh, atau kosong. */
export function profileOf(user: MockUser): {
  gender: string | null;
  city: string | null;
  province: string | null;
} {
  // Setelah user pernah diedit, `user.profile` menggantikan data contoh sepenuhnya
  // (supaya isian yang dikosongkan tidak "hidup lagi" dari data contoh).
  if (user.profile) return user.profile;
  const seed = PROFILE_SEED[user.username];
  return {
    gender: seed?.gender ?? null,
    city: seed?.city ?? null,
    province: seed?.province ?? null,
  };
}

/** Status dalam huruf besar. Data seed lama menyimpan "Active"/"Inactive". */
export function normalizedStatus(user: MockUser): string {
  return user.status.toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Serializer                                                          */
/* ------------------------------------------------------------------ */

/** Satu user dalam bentuk `UserData::toArray` (tanpa `organizations`/`staff_assignments`). */
export function apiUserRecord(user: MockUser): ApiUser {
  const profile = profileOf(user);
  return {
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name ?? null,
    phone: user.phone ?? null,
    status: normalizedStatus(user),
    email_verified: user.emailVerified ?? true,
    profile: {
      date_of_birth: null,
      gender: profile.gender,
      address: null,
      city: profile.city,
      province: profile.province,
      nation: null,
      postal_code: null,
    },
    roles: roleCodesOf(user).flatMap((code) => {
      const role = findMockRole(code);
      return role ? [{ uuid: role.uuid, code, name: role.name }] : [];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Pemeriksaan umum                                                    */
/* ------------------------------------------------------------------ */

function invalid(errors: Record<string, string[]>): never {
  throw new ApiError(422, Object.values(errors).flat().join(" "), errors);
}

function forbidden(message = FORBIDDEN_MESSAGE): never {
  throw new ApiError(403, message);
}

function requirePermission(actor: MockUser, code: string) {
  if (!mockAccess(actor).permissions.includes(code)) forbidden();
}

const isSuperAdmin = (user: MockUser) =>
  roleCodesOf(user).includes(SUPER_ADMIN_CODE);

function findUser(uuid: string): MockUser {
  const user = store.users.find((u) => u.uuid === uuid);
  if (!user) throw new ApiError(404, "User not found.");
  return user;
}

/**
 * Aturan `assertMayManageRoles` backend: hanya super admin yang boleh memberi/mencabut
 * SUPER_ADMIN, dan hanya super admin yang boleh mengubah role seorang super admin.
 * Pesan sama dengan `ForbiddenUserEditException`.
 */
function assertMayManageRoles(
  actor: MockUser,
  target: MockUser | null,
  roleCodes: string[],
) {
  if (isSuperAdmin(actor)) return;
  const message = "You cannot modify a super admin.";
  if (roleCodes.includes(SUPER_ADMIN_CODE)) forbidden(message);
  if (target && isSuperAdmin(target)) forbidden(message);
}

/** Jumlah user ACTIVE yang memegang SUPER_ADMIN (`countActiveSuperAdmins`). */
export function countActiveSuperAdmins(): number {
  return store.users.filter(
    (u) => normalizedStatus(u) === "ACTIVE" && isSuperAdmin(u),
  ).length;
}

/** Jumlah user yang memegang satu role (untuk `users_count` di `/auth/roles`). */
function usersWithRole(code: string): number {
  return store.users.filter((u) => roleCodesOf(u).includes(code)).length;
}

const textOf = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/** True bila `value` ada dan bukan string (form request `string` menolak angka/objek). */
const isNonString = (value: unknown) =>
  value !== undefined && value !== null && typeof value !== "string";

/* ------------------------------------------------------------------ */
/* GET /users                                                          */
/* ------------------------------------------------------------------ */

/**
 * `GET /users`. Backend asli: butuh `user.view`; filter `q` (nama, username, email), `status`,
 * `role`; urut nama depan. Tambahan mock (kontrak users bagian 1): filter `email`, `phone`,
 * `city`, `sort` + `direction`, dan `organization_id` (anggota organisasi lebih dulu +
 * `is_member`). Pencarian dengan `q` atau `organization_id` boleh untuk semua yang login:
 * dipakai pencarian PIC oleh organizer (backend asli masih 403, doc 09).
 */
export function listUserRecords(actor: MockUser, query: URLSearchParams) {
  const q = textOf(query.get("q")).toLowerCase();
  const organizationId = query.get("organization_id");
  const searching = q.length > 0 || Boolean(organizationId);
  if (!searching) requirePermission(actor, PERMISSION.USER_VIEW);

  const status = query.get("status");
  if (status && !USER_STATUSES.some((s) => s === status))
    invalid({ status: ["The selected status is invalid."] });
  const perPage = query.get("per_page");
  if (
    perPage !== null &&
    !(Number(perPage) >= 1 && Number(perPage) <= MAX_PER_PAGE)
  )
    invalid({
      per_page: [`The per page field must be between 1 and ${MAX_PER_PAGE}.`],
    });
  const sort = query.get("sort") ?? "name";
  if (!USER_SORTS.some((s) => s === sort))
    invalid({ sort: ["The selected sort is invalid."] });
  const direction = query.get("direction") === "desc" ? "desc" : "asc";

  const email = textOf(query.get("email")).toLowerCase();
  const phone = textOf(query.get("phone")).toLowerCase();
  const city = textOf(query.get("city")).toLowerCase();
  const role = query.get("role");

  const matches = store.users.filter((u) => {
    const fullName = `${u.first_name} ${u.last_name ?? ""}`;
    return (
      (!q ||
        [
          u.username,
          u.email,
          u.first_name,
          u.last_name ?? "",
          u.phone ?? "",
          fullName,
        ].some((v) => v.toLowerCase().includes(q))) &&
      (!email || u.email.toLowerCase().includes(email)) &&
      (!phone || (u.phone ?? "").toLowerCase().includes(phone)) &&
      (!city || (profileOf(u).city ?? "").toLowerCase().includes(city)) &&
      (!status || normalizedStatus(u) === status) &&
      (!role || roleCodesOf(u).includes(role))
    );
  });

  const keyOf = (u: MockUser) =>
    sort === "email"
      ? u.email.toLowerCase()
      : `${u.first_name} ${u.last_name ?? ""}`.toLowerCase();
  const sorted = [...matches].sort(
    (a, b) =>
      keyOf(a).localeCompare(keyOf(b)) * (direction === "desc" ? -1 : 1),
  );

  const page = new URLSearchParams(query);
  if (!page.has("per_page")) page.set("per_page", String(DEFAULT_PER_PAGE));

  const organization = store.organizations.find(
    (o) => o.uuid === organizationId,
  );
  if (!organization) return paginate(sorted.map(apiUserRecord), page);
  const isMember = (u: MockUser) =>
    organization.pics.some((pic) => pic.user_uuid === u.uuid);
  const memberFirst = [...sorted].sort(
    (a, b) => Number(isMember(b)) - Number(isMember(a)),
  );
  return paginate(
    memberFirst.map((u) => ({ ...apiUserRecord(u), is_member: isMember(u) })),
    page,
  );
}

/** `GET /users/{uuid}`: butuh `user.view`; 404 bila tidak ada. */
export function getUserRecord(actor: MockUser, uuid: string): ApiUser {
  requirePermission(actor, PERMISSION.USER_VIEW);
  return apiUserRecord(findUser(uuid));
}

/* ------------------------------------------------------------------ */
/* POST/PATCH/DELETE /users                                            */
/* ------------------------------------------------------------------ */

/** Memeriksa isi `roles` di body: harus array berisi kode role yang ada. */
function validateRoleList(
  body: Record<string, unknown>,
  errors: Record<string, string[]>,
) {
  const roles = body.roles;
  if (roles === undefined || roles === null) return;
  if (!Array.isArray(roles)) {
    errors.roles = ["The roles field must be an array."];
    return;
  }
  for (const code of roles) {
    if (typeof code !== "string" || !findMockRole(code)) {
      errors.roles = ["The selected roles is invalid."];
      return;
    }
  }
}

/** Aturan `CreateRequest`. Melempar 422 dengan semua pesan sekaligus (seperti Laravel). */
function validateCreate(body: Record<string, unknown>) {
  const errors: Record<string, string[]> = {};
  const username = textOf(body.username);
  const email = textOf(body.email).toLowerCase();
  if (!username) errors.username = ["The username field is required."];
  else if (username.length > 100)
    errors.username = [
      "The username field must not be greater than 100 characters.",
    ];
  else if (
    store.users.some((u) => u.username.toLowerCase() === username.toLowerCase())
  )
    errors.username = ["The username has already been taken."];
  if (!email) errors.email = ["The email field is required."];
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = ["The email field must be a valid email address."];
  else if (store.users.some((u) => u.email.toLowerCase() === email))
    errors.email = ["The email has already been taken."];
  if (!textOf(body.first_name))
    errors.first_name = ["The first name field is required."];
  else if (textOf(body.first_name).length > 100)
    errors.first_name = [
      "The first name field must not be greater than 100 characters.",
    ];
  if (textOf(body.last_name).length > 100)
    errors.last_name = [
      "The last name field must not be greater than 100 characters.",
    ];
  if (textOf(body.phone).length > 30)
    errors.phone = ["The phone field must not be greater than 30 characters."];
  if (body.status && !USER_STATUSES.some((s) => s === body.status))
    errors.status = ["The selected status is invalid."];
  validateRoleList(body, errors);
  if (Object.keys(errors).length) invalid(errors);
}

/**
 * `POST /users`. Butuh `user.manage`. Hanya username, email, first_name, last_name, phone,
 * status, roles yang dipakai (field lain, mis. gender dan kota, diabaikan seperti backend
 * asli: profil lewat PATCH). Hanya super admin yang boleh memberi SUPER_ADMIN.
 * Akun baru belum terverifikasi emailnya; backend asli mengirim email atur password.
 */
export function createUserRecord(
  actor: MockUser,
  body: Record<string, unknown> | undefined,
): ApiUser {
  const data = body ?? {};
  validateCreate(data);
  requirePermission(actor, PERMISSION.USER_MANAGE);
  const roles = Array.isArray(data.roles) ? (data.roles as string[]) : [];
  assertMayManageRoles(actor, null, roles);

  const lastName = textOf(data.last_name);
  const phone = textOf(data.phone);
  const user: MockUser = {
    uuid: nextUuid(),
    username: textOf(data.username),
    email: textOf(data.email).toLowerCase(),
    password: "",
    first_name: textOf(data.first_name),
    last_name: lastName || undefined,
    phone: phone || undefined,
    status: typeof data.status === "string" ? data.status : "ACTIVE",
    roles: [...new Set(roles)],
    emailVerified: false,
  };
  store.users.push(user);
  return apiUserRecord(user);
}

/** Aturan `UpdateRequest` (semua field opsional). */
function validateUpdate(body: Record<string, unknown>) {
  const errors: Record<string, string[]> = {};
  if ("first_name" in body && !textOf(body.first_name))
    errors.first_name = ["The first name field must be a string."];
  for (const [field, max] of [
    ["last_name", 100],
    ["phone", 30],
    ["city", 100],
    ["province", 100],
    ["nation", 100],
    ["address", 1000],
  ] as const) {
    const value = body[field];
    if (isNonString(value))
      errors[field] = [
        `The ${field.replace("_", " ")} field must be a string.`,
      ];
    else if (textOf(value).length > max)
      errors[field] = [
        `The ${field.replace("_", " ")} field must not be greater than ${max} characters.`,
      ];
  }
  if (body.gender && !GENDERS.some((g) => g === body.gender))
    errors.gender = ["The selected gender is invalid."];
  if ("status" in body && !USER_STATUSES.some((s) => s === body.status))
    errors.status = ["The selected status is invalid."];
  if (Object.keys(errors).length) invalid(errors);
}

/**
 * `PATCH /users/{uuid}`. Butuh `user.manage`. username dan email TIDAK bisa diubah.
 * Yang boleh: first_name, last_name, phone, gender, city, province, status (dan
 * date_of_birth/address/nation yang tidak ditampilkan mock). Mengubah super admin oleh
 * non super admin: 403.
 */
export function updateUserRecord(
  actor: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiUser {
  const data = body ?? {};
  validateUpdate(data);
  requirePermission(actor, PERMISSION.USER_MANAGE);
  const user = findUser(uuid);
  if (isSuperAdmin(user) && !isSuperAdmin(actor))
    forbidden("You cannot modify a super admin.");

  if ("first_name" in data) user.first_name = textOf(data.first_name);
  if ("last_name" in data) user.last_name = textOf(data.last_name) || undefined;
  if ("phone" in data) user.phone = textOf(data.phone) || undefined;
  if ("status" in data) user.status = String(data.status);
  const current = profileOf(user);
  user.profile = {
    gender: ("gender" in data ? textOf(data.gender) : current.gender) || null,
    city: ("city" in data ? textOf(data.city) : current.city) || null,
    province:
      ("province" in data ? textOf(data.province) : current.province) || null,
  };
  return apiUserRecord(user);
}

/**
 * `DELETE /users/{uuid}`: menonaktifkan (status SUSPENDED), bukan menghapus. Butuh
 * `user.manage`. Tidak boleh menonaktifkan diri sendiri (422) dan tidak boleh menyentuh
 * super admin bila bukan super admin (403).
 */
export function deactivateUserRecord(actor: MockUser, uuid: string): null {
  requirePermission(actor, PERMISSION.USER_MANAGE);
  const user = findUser(uuid);
  if (user.uuid === actor.uuid)
    throw new ApiError(422, "You cannot deactivate your own account.");
  if (isSuperAdmin(user) && !isSuperAdmin(actor))
    forbidden("You cannot modify a super admin.");
  user.status = "SUSPENDED";
  return null;
}

/* ------------------------------------------------------------------ */
/* Role per user                                                       */
/* ------------------------------------------------------------------ */

/** `POST /users/{uuid}/roles` body `{ role }`. Idempotent: memberi role yang sudah ada tidak error. */
export function assignRoleRecord(
  actor: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiUser {
  const code = textOf(body?.role);
  if (!code) invalid({ role: ["The role field is required."] });
  if (!findMockRole(code)) invalid({ role: ["The selected role is invalid."] });
  requirePermission(actor, PERMISSION.USER_MANAGE);
  const user = findUser(uuid);
  assertMayManageRoles(actor, user, [code]);
  const roles = roleCodesOf(user);
  if (!roles.includes(code)) user.roles = [...roles, code];
  return apiUserRecord(user);
}

/**
 * `DELETE /users/{uuid}/roles/{code}`. Role tidak dikenal: 404. Mencabut SUPER_ADMIN dari
 * super admin aktif terakhir: 422 "The last super admin cannot be removed."
 */
export function revokeRoleRecord(
  actor: MockUser,
  uuid: string,
  code: string,
): ApiUser {
  requirePermission(actor, PERMISSION.USER_MANAGE);
  const user = findUser(uuid);
  const role = findMockRole(code);
  if (!role) throw new ApiError(404, "Role not found.");
  assertMayManageRoles(actor, user, [role.code]);
  const roles = roleCodesOf(user);
  if (
    role.code === SUPER_ADMIN_CODE &&
    roles.includes(SUPER_ADMIN_CODE) &&
    countActiveSuperAdmins() <= 1
  )
    throw new ApiError(422, "The last super admin cannot be removed.");
  user.roles = roles.filter((c) => c !== role.code);
  return apiUserRecord(user);
}

/* ------------------------------------------------------------------ */
/* Roles dan permissions                                               */
/* ------------------------------------------------------------------ */

/** `GET /auth/roles`: terbuka untuk semua yang login. `data = { items }`. */
export function listRoleRecords(): { items: ApiRole[] } {
  return { items: roleRecords(usersWithRole) };
}

/** `GET /auth/permissions`: butuh `user.view`. `data` = objek modul -> permission. */
export function listPermissionRecords(actor: MockUser): ApiPermissionsByModule {
  requirePermission(actor, PERMISSION.USER_VIEW);
  return permissionRecords();
}

/** Jumlah permission yang dikenal (dipakai tes agar tidak menulis angka dua kali). */
export const PERMISSION_COUNT = ALL_PERMISSION_CODES.length;

/* ------------------------------------------------------------------ */
/* Wilayah: /master/countries, provinces, cities                       */
/* ------------------------------------------------------------------ */

const COUNTRY: ApiCountry = {
  uuid: "country-id",
  code: "ID",
  name: "Indonesia",
};

const PROVINCES: ApiProvince[] = [
  { uuid: "prov-31", code: "31", name: "DKI Jakarta" },
  { uuid: "prov-32", code: "32", name: "Jawa Barat" },
  { uuid: "prov-33", code: "33", name: "Jawa Tengah" },
  { uuid: "prov-35", code: "35", name: "Jawa Timur" },
  { uuid: "prov-36", code: "36", name: "Banten" },
  { uuid: "prov-51", code: "51", name: "Bali" },
];

/** [kode, nama, kode provinsi]. Kota yang dipakai data contoh user ada semua di sini. */
const CITY_ROWS: [string, string, string][] = [
  ["3171", "Jakarta Pusat", "31"],
  ["3173", "Jakarta Barat", "31"],
  ["3174", "Jakarta Selatan", "31"],
  ["3271", "Bogor", "32"],
  ["3273", "Bandung", "32"],
  ["3275", "Bekasi", "32"],
  ["3276", "Depok", "32"],
  ["3372", "Surakarta", "33"],
  ["3374", "Semarang", "33"],
  ["3573", "Malang", "35"],
  ["3578", "Surabaya", "35"],
  ["3671", "Tangerang", "36"],
  ["3674", "Tangerang Selatan", "36"],
  ["5171", "Denpasar", "51"],
];

/** `GET /master/countries`: array datar (bukan `items`), seperti `MasterController`. */
export function listCountryRecords(): ApiCountry[] {
  return [COUNTRY];
}

/** `GET /master/provinces?country_id=`: wajib; negara tidak dikenal 404 (`firstOrFail`). */
export function listProvinceRecords(query: URLSearchParams): ApiProvince[] {
  if (query.get("country_id") !== COUNTRY.uuid)
    throw new ApiError(404, "The requested resource was not found.");
  return PROVINCES;
}

/** `GET /master/cities?province_id=`: wajib; provinsi tidak dikenal 404. Urut nama. */
export function listCityRecords(query: URLSearchParams): ApiCity[] {
  const province = PROVINCES.find((p) => p.uuid === query.get("province_id"));
  if (!province)
    throw new ApiError(404, "The requested resource was not found.");
  return CITY_ROWS.filter(
    ([, , provinceCode]) => provinceCode === province.code,
  )
    .map(([code, name]) => ({ uuid: `city-${code}`, code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
