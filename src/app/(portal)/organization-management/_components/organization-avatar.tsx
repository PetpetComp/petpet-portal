import { initials } from "@/lib/identity";
import { cn } from "@/lib/utils";

/** Ukuran kotak: "sm" untuk baris daftar (36px), "lg" untuk header detail (60px). */
type AvatarSize = "sm" | "lg";

const SIZE: Record<AvatarSize, string> = {
  sm: "size-9 rounded-[10px] bg-muted text-xs",
  lg: "size-15 rounded-2xl bg-primary-soft text-primary-dark font-display text-xl",
};

/**
 * Kotak inisial organisasi (contoh "EJ" untuk East Java Pet Sport), dua huruf pertama dari
 * dua kata pertama. Dipanggil dari daftar organisasi dan header detail.
 */
export function OrganizationAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: AvatarSize;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-extrabold",
        SIZE[size],
      )}
    >
      {initials(name, "?")}
    </span>
  );
}

/** Badge hijau "Verified": organisasi sudah disetujui (status ACTIVE). Label teks selalu ikut. */
export function VerifiedBadge() {
  return (
    <span className="bg-done-soft text-done rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">
      Verified
    </span>
  );
}
