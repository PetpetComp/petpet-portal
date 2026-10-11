import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/**
 * Keterangan ramah untuk tab yang hanya boleh dilihat anggota atau pengelola organisasi.
 * Menggantikan request yang pasti dijawab 403 oleh backend. Dipanggil dari tab Members,
 * Pending invitations, dan kartu verifikasi.
 */
export function RestrictedNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="border-border text-muted-foreground flex items-center gap-3 rounded-2xl border bg-white p-5"
    >
      <Lock size={18} aria-hidden className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}
