import { cn } from "@/lib/utils";

/** Ukuran bulatan: "sm" untuk baris tabel (36px, desain Users), "lg" untuk header detail. */
type AvatarSize = "sm" | "lg";

const SIZE: Record<AvatarSize, string> = {
  sm: "size-9 text-[13px]",
  lg: "size-16 font-display text-xl",
};

/**
 * Bulatan inisial user ("SP" untuk Salsa Putri) sebagai pengganti foto.
 * Dipanggil dari tabel list dan header detail. Hanya hiasan: nama selalu ikut tampil
 * di sebelahnya, jadi disembunyikan dari pembaca layar.
 */
export function UserAvatar({
  initials,
  size = "sm",
}: {
  initials: string;
  size?: AvatarSize;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary-soft text-primary-dark grid shrink-0 place-items-center rounded-full font-extrabold",
        SIZE[size],
      )}
    >
      {initials}
    </span>
  );
}
