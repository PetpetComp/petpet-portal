import { useAuth } from "@/hooks/use-auth";
import type { AccessProfile } from "@/lib/auth/access";
import { organizationRights, type OrganizationRights } from "./access";

/**
 * Akses akun yang sedang login dalam bentuk `AccessProfile` (peran, permission, keanggotaan,
 * penugasan) untuk helper murni di `access.ts`. Dipanggil dari komponen organisasi.
 */
export function useAccessProfile(): AccessProfile {
  const { roles, permissions, memberships, assignments } = useAuth();
  return { roles, permissions, memberships, assignments };
}

/**
 * Hak akun yang login pada satu organisasi (lihat anggota, undang, ubah peran, dst).
 * Aturannya ada di `organizationRights`; hook ini hanya menyambungkannya ke sesi.
 */
export function useOrganizationRights(
  organizationId: string,
): OrganizationRights {
  return organizationRights(useAccessProfile(), organizationId);
}
