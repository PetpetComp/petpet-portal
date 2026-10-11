import { permissionCount } from "@/domains/users/roles";
import type { Role } from "@/domains/users/types";
import { cn } from "@/lib/utils";

/**
 * Daftar kartu role di kiri matriks. Klik kartu menyorot kolom role itu di matriks.
 * Jumlah user dan jumlah permission hanya tampil bila API mengirimnya (belum di backend
 * asli); kalau tidak, bagian itu disembunyikan, bukan diisi angka contoh.
 * Dipanggil dari `RolesPage`.
 */
export function RoleCards({
  roles,
  focus,
  onPick,
}: {
  roles: Role[];
  focus: string;
  onPick: (code: string) => void;
}) {
  return (
    <section
      aria-label="Roles"
      className="flex max-w-80 min-w-0 flex-[1_1_260px] flex-col gap-2.5"
    >
      {roles.map((role) => {
        const selected = role.code === focus;
        const count = permissionCount(role);
        return (
          <button
            key={role.code}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(role.code)}
            className={cn(
              "grid cursor-pointer gap-1 rounded-2xl bg-white px-4 py-3.5 text-left",
              selected ? "border-primary border-2" : "border-border border",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <b>{role.name}</b>
              {role.usersCount !== null && (
                <span className="text-muted-foreground font-mono text-xs font-semibold">
                  {role.usersCount} {role.usersCount === 1 ? "user" : "users"}
                </span>
              )}
            </span>
            <span className="text-primary font-mono text-xs font-medium">
              {role.code}
              {count !== null && ` · ${count} permissions`}
            </span>
            {role.description && (
              <span className="text-muted-foreground text-[13px] leading-[19px]">
                {role.description}
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
