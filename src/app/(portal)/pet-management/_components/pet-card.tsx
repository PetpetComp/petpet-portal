import Link from "next/link";
import { ageWeightLine } from "@/domains/pets/format";
import { speciesMorphLine, type Pet } from "@/domains/pets/types";
import { ROUTES } from "@/lib/constants/routes";
import { PetAvatar } from "./pet-avatar";

/**
 * Satu kartu pet di grid list (desain Pets): avatar, nama, "Spesies · Morph",
 * lalu pemilik di kiri dan "umur · berat" di kanan. Seluruh kartu adalah tautan ke detail.
 * Dipanggil dari `PetsPage`.
 *
 * Backend asli belum mengirim nama pemilik; list-nya hanya berisi pet milik pemanggil,
 * jadi bila nama kosong baris pemilik menulis "You".
 */
export function PetCard({ pet }: { pet: Pet }) {
  return (
    <Link
      href={ROUTES.pets.detail(pet.id)}
      className="border-border hover:border-lilac-300 focus-visible:outline-ring grid min-w-0 gap-3 rounded-2xl border bg-white p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="flex items-center gap-3">
        <PetAvatar name={pet.name} speciesName={pet.speciesName} />
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-base">{pet.name}</b>
          <span className="text-muted-foreground truncate">
            {speciesMorphLine(pet) || "-"}
          </span>
        </span>
      </span>
      <span className="text-primary-dark flex justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate">{pet.ownerName || "You"}</span>
        <span className="shrink-0">{ageWeightLine(pet)}</span>
      </span>
    </Link>
  );
}
