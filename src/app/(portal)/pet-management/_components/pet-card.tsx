import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatWeight, petAgeLabel } from "@/domains/pets/format";
import { speciesMorphLine, type Pet } from "@/domains/pets/types";
import { ROUTES } from "@/lib/constants/routes";
import { PetAvatar } from "./pet-avatar";

/**
 * Lebar kolom baris list pada layar >= md: pet, spesies/morph, pemilik, gender, umur, berat, panah.
 * Dipakai bersama oleh header kolom (`PetListHeader`) dan tiap baris (`PetRow`) supaya sejajar.
 */
const COLUMNS =
  "md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_72px_72px_80px_16px]";

/** Header kolom list pet. Hanya tampil di layar >= md; di HP baris berbentuk kartu. */
export function PetListHeader() {
  return (
    <div
      aria-hidden
      className={`text-muted-foreground bg-muted/40 hidden gap-4 px-5 py-2.5 text-xs font-bold tracking-wide uppercase md:grid ${COLUMNS}`}
    >
      <span>Pet</span>
      <span>Species / morph</span>
      <span>Owner</span>
      <span>Gender</span>
      <span>Age</span>
      <span>Weight</span>
      <span />
    </div>
  );
}

/**
 * Satu baris pet di list. Di HP berupa kartu bertumpuk (avatar + nama, spesies, pemilik, lalu
 * gender/umur/berat sebaris); di >= md menjadi baris tabel berkolom (`md:contents` membuat anak
 * baris ikut grid induk). Seluruh baris adalah tautan ke detail. Dipanggil dari `PetsPage`.
 *
 * Backend asli belum mengirim nama pemilik; list-nya hanya berisi pet milik pemanggil,
 * jadi bila nama kosong kolom pemilik menulis "You".
 */
export function PetRow({ pet }: { pet: Pet }) {
  return (
    <Link
      href={ROUTES.pets.detail(pet.id)}
      className={`hover:bg-muted/40 focus-visible:outline-ring grid min-w-0 items-center gap-2 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 md:gap-4 md:px-5 ${COLUMNS}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <PetAvatar name={pet.name} speciesName={pet.speciesName} />
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-base">{pet.name}</b>
          <span className="text-muted-foreground truncate text-[13px]">
            {pet.registrationNumber || "No registration number"}
          </span>
        </span>
      </span>
      <span className="min-w-0 truncate">{speciesMorphLine(pet) || "-"}</span>
      <span className="text-primary-dark min-w-0 truncate text-[13px] md:text-sm">
        {pet.ownerName || "You"}
      </span>
      <span className="text-muted-foreground flex flex-wrap gap-x-3 text-[13px] md:contents md:text-sm">
        <span>{pet.gender || "-"}</span>
        <span>{petAgeLabel(pet.birthDate) || "-"}</span>
        <span>{formatWeight(pet.weightGrams) || "-"}</span>
      </span>
      <ChevronRight
        size={16}
        aria-hidden
        className="text-muted-foreground hidden md:block"
      />
    </Link>
  );
}
