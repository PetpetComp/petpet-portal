import type { ApiPageMeta } from "@/types/api";
import type { Meta } from "@/types/common";
import { initials } from "@/lib/identity";

/**
 * Satu user dari `GET /users` (petpet-service `UserData::toArray`, bagian yang dipakai pencarian).
 * `is_member` BELUM dikirim backend asli: kontrak 13 bagian 1, hanya ada bila request
 * membawa `organization_id`. Mock sudah mengirimnya.
 */
export type ApiUserSummary = {
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  status: string;
  is_member?: boolean;
};

/** Hasil pencarian user untuk dipilih (mis. PIC event). Dibuat oleh `userHitFromApi`. */
export type UserHit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** True bila anggota organisasi yang dikirim saat mencari. */
  isMember: boolean;
};

/** Pencarian user: jumlah ditampilkan dibatasi, `total` = semua yang cocok. */
export type UserSearchResult = { items: UserHit[]; total: number };

/** Syarat backend: pencarian baru jalan dari 2 huruf (docs 08 bagian 9.1). */
export const USER_SEARCH_MIN_LENGTH = 2;
/** Maksimal hasil yang ditampilkan (docs 08 bagian 9.1). */
export const USER_SEARCH_LIMIT = 5;

/** Nama lengkap, atau username bila nama belakang kosong dan nama depan juga kosong. */
export function userHitFromApi(row: ApiUserSummary): UserHit {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return {
    id: row.uuid,
    name: name || row.username,
    email: row.email,
    phone: row.phone,
    isMember: row.is_member ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* Users (list, form, detail)                                          */
/* ------------------------------------------------------------------ */

/** Status akun (backend enum `UserStatus`). Hapus user = SUSPENDED, bukan menghapus baris. */
export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

/** Nilai gender yang diterima backend (`UserConstant::GENDERS`). */
export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

/** Kode role platform (backend enum `RoleCode`). Daftar sebenarnya dibaca dari `GET /auth/roles`. */
export const ROLE_CODES = [
  "SUPER_ADMIN",
  "ORGANIZATION_OWNER",
  "ORGANIZER",
  "EVENT_PIC",
  "JUDGE",
  "USER",
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

/** Role yang hanya boleh diberikan/dicabut oleh super admin (aturan backend `assertMayManageRoles`). */
export const SUPER_ADMIN_ROLE: RoleCode = "SUPER_ADMIN";
/** Role bawaan akun baru di form New user (sesuai desain: kotak "User" tercentang). */
export const DEFAULT_ROLE: RoleCode = "USER";

/** Role yang menempel di user: `UserData::fromModel` -> `roles`. */
export type ApiUserRole = { uuid: string; code: string; name: string };

/** `profile` di dalam `UserData::toArray`. Semua boleh null. */
export type ApiUserProfile = {
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  nation: string | null;
  postal_code: string | null;
};

/**
 * Satu user persis seperti `UserData::toArray` di petpet-service. `roles` ikut di list dan
 * detail. `organizations` dan `staff_assignments` hanya ada bila relasinya dimuat backend
 * (sekarang tidak untuk `/users`), dan layar ini tidak memakainya.
 */
export type ApiUser = {
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  status: string;
  email_verified: boolean;
  profile: ApiUserProfile;
  roles?: ApiUserRole[];
};

/** `data` dari `GET /users`. */
export type ApiUserList = { items: ApiUser[]; meta: ApiPageMeta };

/** Role yang menempel di user, bentuk layar. */
export type UserRole = { id: string; code: string; name: string };

/** Seorang user seperti yang dipakai layar. Dibuat hanya oleh `userFromApi`. */
export type User = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Nama lengkap, atau username bila nama kosong. */
  name: string;
  initials: string;
  phone: string;
  status: UserStatus;
  emailVerified: boolean;
  /** Kosong bila belum diisi atau nilainya bukan MALE/FEMALE. */
  gender: Gender | "";
  address: string;
  city: string;
  province: string;
  roles: UserRole[];
};

/** Satu halaman list user. */
export type UserPage = { items: User[]; meta: Meta };

/** Kolom yang boleh dipakai `sort`. HANYA mock; backend asli selalu urut nama depan. */
export const USER_SORTS = ["name", "email"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export type SortDirection = "asc" | "desc";

/**
 * Filter, sort, dan paging list user yang dikirim ke server. `page` mulai dari 1.
 * Backend asli baru mendukung `q`, `status`, `role`; sisanya (`email`, `phone`, `city`,
 * `sort`, `direction`) hanya dilayani mock dan disembunyikan di mode backend asli.
 */
export type UserListQuery = {
  /** Cari nama depan/belakang, username, email (backend: ilike). */
  q?: string;
  email?: string;
  phone?: string;
  city?: string;
  status?: UserStatus;
  /** Kode role, mis. "ORGANIZER". */
  role?: string;
  sort?: UserSort;
  direction?: SortDirection;
  page: number;
  perPage: number;
};

/**
 * Bentuk query string API dari `UserListQuery`. Teks dipangkas; nilai kosong dibuang oleh
 * `buildUrl`. Dipanggil dari `listUsers`; dites di types.test.ts.
 */
export function userListParams(query: UserListQuery) {
  return {
    q: query.q?.trim(),
    email: query.email?.trim(),
    phone: query.phone?.trim(),
    city: query.city?.trim(),
    status: query.status,
    role: query.role,
    sort: query.sort,
    direction: query.direction,
    page: query.page,
    per_page: query.perPage,
  };
}

/** Status dari API -> `UserStatus`. Nilai tak dikenal dianggap INACTIVE (netral). */
function toUserStatus(raw: string): UserStatus {
  const upper = raw.toUpperCase();
  return USER_STATUSES.find((s) => s === upper) ?? "INACTIVE";
}

function toGender(raw: string | null | undefined): Gender | "" {
  const upper = (raw ?? "").toUpperCase();
  return GENDERS.find((g) => g === upper) ?? "";
}

/** Satu baris API -> bentuk layar. Mapper satu-satunya untuk `ApiUser`. */
export function userFromApi(row: ApiUser): User {
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ") || row.username;
  return {
    id: row.uuid,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name ?? "",
    name,
    initials: initials(name, "U"),
    phone: row.phone ?? "",
    status: toUserStatus(row.status),
    emailVerified: row.email_verified,
    gender: toGender(row.profile?.gender),
    address: row.profile?.address ?? "",
    city: row.profile?.city ?? "",
    province: row.profile?.province ?? "",
    roles: (row.roles ?? []).map((r) => ({
      id: r.uuid,
      code: r.code,
      name: r.name,
    })),
  };
}

/** `data` dari `GET /users` -> `UserPage`. */
export function userPageFromApi(data: ApiUserList): UserPage {
  return {
    items: data.items.map(userFromApi),
    meta: {
      currentPage: data.meta.current_page,
      perPage: data.meta.per_page,
      total: data.meta.total,
      lastPage: data.meta.last_page,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Wilayah untuk form (provinsi dan kota)                              */
/* ------------------------------------------------------------------ */

/** Negara dari `GET /master/countries`. */
export type ApiCountry = { uuid: string; code: string; name: string };
/** Provinsi dari `GET /master/provinces?country_id=`. */
export type ApiProvince = { uuid: string; code: string; name: string };
/** Kota/kabupaten dari `GET /master/cities?province_id=`. */
export type ApiCity = { uuid: string; code: string; name: string };

/** Kode negara yang dipakai form (alamat user di Indonesia). */
export const COUNTRY_CODE = "ID";

/** Satu pilihan di select wilayah. Profil user menyimpan NAMA (teks), bukan uuid. */
export type RegionOption = { id: string; name: string };

/* ------------------------------------------------------------------ */
/* Roles & access                                                      */
/* ------------------------------------------------------------------ */

/** Satu role dari `GET /auth/roles` (`RoleData::toArray`). */
export type ApiRole = {
  uuid: string;
  code: string;
  name: string;
  description: string | null;
  /**
   * Kode permission yang dimiliki role ini. BELUM dikirim backend asli (doc 09): tanpa
   * ini matriks tidak bisa menampilkan centang. Mock mengirimnya.
   */
  permissions?: string[];
  /** Jumlah user dengan role ini. BELUM dikirim backend asli. Mock mengirimnya. */
  users_count?: number;
};

/** `data` dari `GET /auth/roles`. */
export type ApiRoleList = { items: ApiRole[] };

/** Satu permission dari `GET /auth/permissions`. */
export type ApiPermission = {
  code: string;
  name: string;
  description: string | null;
};

/** `data` dari `GET /auth/permissions`: kunci = modul ("event"), isi = permission modul itu. */
export type ApiPermissionsByModule = Record<string, ApiPermission[]>;

/** Role seperti layar memakainya. `permissions`/`usersCount` null bila API belum mengirimnya. */
export type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[] | null;
  usersCount: number | null;
};

/** Permission seperti layar memakainya. */
export type AccessPermission = {
  code: string;
  name: string;
  description: string;
};

/** Satu modul beserta permission-nya (satu bagian di matriks). */
export type PermissionGroup = {
  module: string;
  permissions: AccessPermission[];
};

/** Satu role API -> bentuk layar. */
export function roleFromApi(row: ApiRole): Role {
  return {
    id: row.uuid,
    code: row.code,
    name: row.name,
    description: row.description ?? "",
    permissions: row.permissions ?? null,
    usersCount: row.users_count ?? null,
  };
}

/** `data` dari `GET /auth/permissions` -> daftar modul, urut sesuai kunci dari server. */
export function permissionGroupsFromApi(
  data: ApiPermissionsByModule,
): PermissionGroup[] {
  return Object.entries(data).map(([module, rows]) => ({
    module,
    permissions: rows.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description ?? "",
    })),
  }));
}
