import { avatarTone, petInitial } from "@/domains/pets/format";
import { cn } from "@/lib/utils";

/**
 * Kotak inisial pet (satu huruf, warna menurut spesies) seperti di desain Pets.
 * Dipakai kartu list (`md`) dan header detail (`lg`). Dekoratif: nama pet selalu ada di dekatnya,
 * jadi disembunyikan dari pembaca layar.
 */
export function PetAvatar({
  name,
  speciesName,
  size = "md",
}: {
  name: string;
  speciesName: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-display grid shrink-0 place-items-center font-extrabold",
        avatarTone(speciesName),
        size === "lg"
          ? "size-16 rounded-2xl text-[26px]"
          : "size-12 rounded-[14px] text-lg",
      )}
    >
      {petInitial(name)}
    </span>
  );
}
