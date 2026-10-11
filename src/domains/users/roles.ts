import { SUPER_ADMIN_ROLE, type PermissionGroup, type Role } from "./types";

/**
 * Logika murni untuk halaman Roles & access (matriks permission per role) dan untuk daftar
 * role di form user. Tanpa React; dites di roles.test.ts.
 */

/** Urutan tampil yang diinginkan desain: dari yang paling berkuasa ke yang paling umum. */
const DISPLAY_ORDER = [
  "SUPER_ADMIN",
  "ORGANIZATION_OWNER",
  "ORGANIZER",
  "EVENT_PIC",
  "JUDGE",
  "USER",
];

/** Label pendek untuk kepala kolom matriks (desain: SUPER, OWNER, ORGANIZER, USER). */
const SHORT_LABEL: Record<string, string> = {
  SUPER_ADMIN: "SUPER",
  ORGANIZATION_OWNER: "OWNER",
  ORGANIZER: "ORGANIZER",
  EVENT_PIC: "PIC",
  JUDGE: "JUDGE",
  USER: "USER",
};

/**
 * Mengurutkan role menurut `DISPLAY_ORDER`. Role yang tidak dikenal (role baru di backend)
 * ditaruh di akhir, urut nama. Tidak mengubah array asli.
 */
export function sortRoles(roles: Role[]): Role[] {
  const rank = (code: string) => {
    const index = DISPLAY_ORDER.indexOf(code);
    return index === -1 ? DISPLAY_ORDER.length : index;
  };
  return [...roles].sort(
    (a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name),
  );
}

/** Label pendek kepala kolom. Role baru memakai nama aslinya dalam huruf besar. */
export function roleShortLabel(role: Pick<Role, "code" | "name">): string {
  return SHORT_LABEL[role.code] ?? role.name.toUpperCase();
}

/**
 * Apakah role ini memegang permission `code`.
 * Mengembalikan `null` bila API belum mengirim daftar permission role itu (tidak diketahui),
 * supaya layar bisa membedakan "tidak punya" dari "tidak tahu".
 */
export function roleHasPermission(role: Role, code: string): boolean | null {
  if (role.permissions === null) return null;
  return role.permissions.includes(code);
}

/** Jumlah permission yang dimiliki role, atau null bila tidak diketahui. */
export function permissionCount(role: Role): number | null {
  return role.permissions === null ? null : role.permissions.length;
}

/** True bila setidaknya satu role membawa daftar permission (matriks bisa diisi). */
export function hasGrantData(roles: Role[]): boolean {
  return roles.some((role) => role.permissions !== null);
}

/**
 * Menyaring matriks: `text` dicocokkan ke kode atau nama permission (tanpa membedakan huruf),
 * `module` membatasi ke satu modul ("" = semua). Modul yang kosong setelah disaring dibuang.
 * Dipanggil dari komponen matriks di tiap ketikan; datanya sudah lengkap di browser.
 */
export function filterPermissionGroups(
  groups: PermissionGroup[],
  text: string,
  module: string,
): PermissionGroup[] {
  const needle = text.trim().toLowerCase();
  return groups
    .filter((group) => !module || group.module === module)
    .map((group) => ({
      module: group.module,
      permissions: group.permissions.filter(
        (p) =>
          !needle ||
          p.code.toLowerCase().includes(needle) ||
          p.name.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.permissions.length > 0);
}

/** Urutan modul di matriks (desain Roles). Backend mengirim urut abjad; layar memakai urutan ini. */
const MODULE_ORDER = [
  "event",
  "competition",
  "registration",
  "payment",
  "payout",
  "scoring",
  "organization",
  "staff",
  "user",
  "master",
  "platform",
];

/** Urutan aksi dalam satu modul: lihat dulu, lalu buat/ubah/hapus, lalu aksi khusus. */
const ACTION_ORDER = [
  "view",
  "create",
  "update",
  "delete",
  "publish",
  "approve",
  "reject",
  "verify",
  "refund",
  "request",
  "input",
  "invite",
  "manage",
  "settings",
];

/** Bagian aksi dari kode permission: "event.update" -> "update". */
function actionOf(code: string): string {
  return code.split(".")[1] ?? code;
}

/**
 * Mengurutkan modul dan permission di dalamnya sesuai desain. Modul atau aksi yang tidak
 * dikenal (ditambah backend kemudian) ditaruh di akhir, urut abjad. Tidak mengubah input.
 */
export function sortPermissionGroups(
  groups: PermissionGroup[],
): PermissionGroup[] {
  const rank = (list: string[], key: string) => {
    const index = list.indexOf(key);
    return index === -1 ? list.length : index;
  };
  return [...groups]
    .sort(
      (a, b) =>
        rank(MODULE_ORDER, a.module) - rank(MODULE_ORDER, b.module) ||
        a.module.localeCompare(b.module),
    )
    .map((group) => ({
      module: group.module,
      permissions: [...group.permissions].sort(
        (a, b) =>
          rank(ACTION_ORDER, actionOf(a.code)) -
            rank(ACTION_ORDER, actionOf(b.code)) ||
          a.code.localeCompare(b.code),
      ),
    }));
}

/** Role yang boleh dipilih oleh pemanggil: super admin hanya ditawarkan ke super admin. */
export function assignableRoles(
  roles: Role[],
  callerIsSuperAdmin: boolean,
): Role[] {
  return roles.filter((r) => callerIsSuperAdmin || r.code !== SUPER_ADMIN_ROLE);
}
