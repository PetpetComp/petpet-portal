import type {
  AssignmentRole,
  AssignmentRoleScope,
  InviteTarget,
} from "./types";

/**
 * Logika murni untuk daftar peran penugasan (tanpa React). Daftar peran selalu datang dari
 * `GET /master/assignment-roles`; file ini hanya mengurutkan, menyaring, dan memberi label.
 */

/** Urutan tampil: `sortOrder` naik, lalu kode supaya hasilnya stabil. Tidak mengubah array asli. */
export function sortRoles(roles: AssignmentRole[]): AssignmentRole[] {
  return [...roles].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

/** Cakupan peran yang cocok untuk satu target: tim event -> EVENT, kompetisi -> COMPETITION. */
export function scopeOfTarget(target: InviteTarget): AssignmentRoleScope {
  return target.kind === "event" ? "EVENT" : "COMPETITION";
}

/**
 * Peran yang boleh dipilih di form undang untuk satu cakupan: hanya yang `isActive`
 * dan cocok dengan cakupan, terurut. Dipanggil dari drawer "Invite member".
 */
export function rolesForScope(
  roles: AssignmentRole[],
  scope: AssignmentRoleScope,
): AssignmentRole[] {
  return sortRoles(roles.filter((r) => r.isActive && r.scope === scope));
}

/**
 * Label chip untuk satu kode peran. Kode yang tidak ada di daftar (mis. peran baru dari
 * backend yang belum dikenal, atau daftar belum dimuat) ditampilkan apa adanya (kontrak 13 bagian 3).
 * Peran nonaktif tetap punya label, supaya penugasan lama tetap terbaca.
 */
export function roleLabel(roles: AssignmentRole[], code: string): string {
  return roles.find((r) => r.code === code)?.label ?? code;
}

/**
 * Peran yang otomatis terpilih di form undang: bila untuk cakupan itu hanya ada satu peran
 * yang boleh (mis. tim event -> Event manager), kodenya dikembalikan; selain itu string kosong
 * supaya pengguna memilih sendiri. Dipanggil dari drawer saat target berubah.
 */
export function defaultRoleFor(
  roles: AssignmentRole[],
  scope: AssignmentRoleScope,
): string {
  const offered = rolesForScope(roles, scope);
  return offered.length === 1 ? offered[0].code : "";
}
