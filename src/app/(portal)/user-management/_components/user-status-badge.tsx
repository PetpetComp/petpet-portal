import { USER_STATUS_LABEL, type UserStatus } from "@/domains/users/types";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap";

/** Gaya per status (token DS-Foundations). Label teks selalu ikut, warna bukan satu-satunya penanda. */
const STYLE: Record<UserStatus, string> = {
  ACTIVE: "bg-success-soft text-success",
  INACTIVE: "border border-dashed border-lilac-300 text-primary-dark",
  SUSPENDED: "bg-danger-soft text-danger-ink",
};

/**
 * Badge status akun: Active / Inactive / Suspended.
 * Dipanggil dari tabel list dan header detail user.
 */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={cn(BASE, STYLE[status])}>{USER_STATUS_LABEL[status]}</span>
  );
}
