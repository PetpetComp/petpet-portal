"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { fieldClass } from "@/components/ui/form-field";
import {
  filterPermissionGroups,
  roleHasPermission,
  roleShortLabel,
} from "@/domains/users/roles";
import type { PermissionGroup, Role } from "@/domains/users/types";
import { cn } from "@/lib/utils";

/** Lebar kolom role di matriks (desain: 112px untuk 4 role; 6 role dipersempit agar muat). */
const ROLE_COLUMN_WIDTH = 96;

/** Kontrol filter 36px seperti baris filter tabel lain. */
const filterClass = `${fieldClass} !min-h-9 !rounded-[10px] !px-2.5 !text-[13px]`;

/** Satu sel matriks: centang (punya), garis (tidak punya), atau "?" (API belum memberi tahu). */
function Cell({
  granted,
  roleName,
}: {
  granted: boolean | null;
  roleName: string;
}) {
  if (granted === null)
    return (
      <span
        aria-label={`Unknown for ${roleName}`}
        className="text-muted-foreground font-bold"
      >
        ?
      </span>
    );
  if (granted)
    return (
      <span
        aria-label={`Granted to ${roleName}`}
        className="bg-primary text-primary-foreground grid size-[22px] place-items-center rounded-full"
      >
        <Check size={13} strokeWidth={3} aria-hidden />
      </span>
    );
  return (
    <span
      aria-label={`Not granted to ${roleName}`}
      className="text-lilac-300 font-bold"
    >
      -
    </span>
  );
}

/**
 * Matriks permission (baris) x role (kolom), dikelompokkan per modul, dengan filter kode/nama
 * dan modul. Role yang dipilih di kartu disorot kolomnya. Semua data sudah ada di browser
 * (tidak berhalaman), jadi penyaringan di sisi klien tepat di sini. Read-only.
 * Dipanggil dari `RolesPage`.
 */
export function PermissionMatrix({
  roles,
  groups,
  focus,
}: {
  roles: Role[];
  groups: PermissionGroup[];
  focus: string;
}) {
  const [text, setText] = useState("");
  const [module, setModule] = useState("");
  const visible = filterPermissionGroups(groups, text, module);
  const columns = `minmax(0,2fr) repeat(${roles.length}, ${ROLE_COLUMN_WIDTH}px)`;

  return (
    <section
      aria-label="Permission matrix"
      className="border-border min-w-0 flex-[999_1_820px] overflow-x-auto rounded-2xl border bg-white"
    >
      <div style={{ minWidth: 300 + roles.length * ROLE_COLUMN_WIDTH }}>
        <div
          className="border-border text-muted-foreground grid items-center border-b px-5 py-3 text-xs font-bold tracking-[0.06em]"
          style={{ gridTemplateColumns: columns }}
        >
          <div>PERMISSION</div>
          {roles.map((role) => (
            <div
              key={role.code}
              title={role.name}
              className={cn(
                "rounded-[10px] py-1.5 text-center",
                role.code === focus && "bg-primary-soft text-primary-dark",
              )}
            >
              {roleShortLabel(role)}
            </div>
          ))}
        </div>
        <div className="border-border bg-primary-soft/40 grid grid-cols-[minmax(0,2fr)_1fr] gap-3 border-b px-5 py-2.5">
          <input
            type="text"
            aria-label="Filter permission"
            placeholder="Code or name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={filterClass}
          />
          <select
            aria-label="Filter module"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            className={filterClass}
          >
            <option value="">All modules</option>
            {groups.map((g) => (
              <option key={g.module} value={g.module}>
                {g.module.charAt(0).toUpperCase() + g.module.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {visible.length === 0 && (
          <p className="text-muted-foreground p-6 text-center">
            No permission matches this filter.
          </p>
        )}
        {visible.map((group) => (
          <div key={group.module}>
            <div className="text-primary-dark bg-background px-5 pt-2.5 pb-1.5 text-xs font-extrabold tracking-[0.06em]">
              {group.module.toUpperCase()}
            </div>
            {group.permissions.map((permission) => (
              <div
                key={permission.code}
                className="border-muted grid items-center border-b px-5 py-2"
                style={{ gridTemplateColumns: columns }}
              >
                <div className="grid gap-0.5">
                  <span className="font-semibold">{permission.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {permission.code}
                  </span>
                </div>
                {roles.map((role) => (
                  <div
                    key={role.code}
                    className={cn(
                      "grid min-h-9 place-items-center rounded-lg",
                      role.code === focus && "bg-primary-soft/40",
                    )}
                  >
                    <Cell
                      granted={roleHasPermission(role, permission.code)}
                      roleName={role.name}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
