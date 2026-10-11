import type { ApiPageMeta } from "@/types/api";
import type { Meta } from "@/types/common";

/**
 * Pilihan jenis kelamin di form. Backend menyimpan teks bebas (maks 20 karakter),
 * jadi daftar ini hanya pilihan di layar; nilai lain dari backend tetap ditampilkan apa adanya.
 */
export const PET_GENDERS = ["Male", "Female"] as const;
export type PetGender = (typeof PET_GENDERS)[number];

/** Kolom yang boleh dipakai untuk `sort` di `GET /pets` (kontrak pets, doc draf). */
export const PET_SORTS = ["name", "birth_date"] as const;
export type PetSort = (typeof PET_SORTS)[number];
export type SortDirection = "asc" | "desc";

/** Hak pemanggil atas satu pet. Dihitung backend (kontrak pets), layar hanya membaca. */
export type ApiPetActions = {
  update: boolean;
  /** False juga bila pet sudah punya entry kompetisi (backend menolak dengan 422). */
  delete: boolean;
};

/**
 * Satu pet persis seperti dikirim API (petpet-service `PetData::toArray`).
 * Field setelah `welfare_status` BELUM dikirim backend asli (kontrak pets, doc 09 bagian P),
 * jadi bertanda opsional. Mock sudah mengirimnya.
 */
export type ApiPet = {
  uuid: string;
  species_uuid: string;
  morph_uuid: string | null;
  registration_number: string | null;
  name: string;
  gender: string | null;
  /** Tanggal "YYYY-MM-DD". */
  birth_date: string | null;
  /** String desimal, contoh "38.00". */
  height_cm: string | null;
  /** String desimal, contoh "130.00". */
  weight_grams: string | null;
  welfare_status: string;
  owner_uuid?: string;
  owner_name?: string;
  species_name?: string;
  morph_name?: string | null;
  actions?: ApiPetActions;
};

/** `data` dari `GET /pets` di kontrak. Backend asli mengirim array datar berisi pet milik pemanggil saja. */
export type ApiPetList = { items: ApiPet[]; meta: ApiPageMeta };

/**
 * Body `POST /pets` dan `PATCH /pets/{uuid}`. Backend asli: create menerima `species_id`
 * dan `morph_id`, update tidak; `owner_id` hanya ada di kontrak (mock), backend asli
 * selalu memakai pemanggil sebagai pemilik.
 */
export type ApiPetBody = {
  name: string;
  species_id?: string;
  morph_id?: string | null;
  registration_number: string | null;
  gender: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_grams: number | null;
  owner_id?: string;
};

/** Satu spesies dari `GET /master/species` (`profile_schema` tidak dipakai layar ini). */
export type ApiSpecies = {
  uuid: string;
  code: string;
  name: string;
  profile_schema?: unknown;
};

/** Satu morph dari `GET /master/pet-morphs`. */
export type ApiPetMorph = {
  uuid: string;
  species_uuid: string;
  code: string;
  name: string;
};

/** Bentuk layar satu pet. Dibuat dari `ApiPet` hanya lewat `fromApi`. */
export type Pet = {
  id: string;
  name: string;
  /** Null bila backend belum mengirim pemilik (mode backend asli). */
  ownerId: string | null;
  /** Kosong bila backend belum mengirim nama pemilik. */
  ownerName: string;
  speciesId: string;
  /** Kosong sampai nama diisi dari master (`withMasterNames`). */
  speciesName: string;
  morphId: string | null;
  morphName: string;
  registrationNumber: string;
  gender: string;
  /** "YYYY-MM-DD" atau kosong. */
  birthDate: string;
  heightCm: number | null;
  weightGrams: number | null;
  welfareStatus: string;
  actions: { update: boolean; delete: boolean };
};

export type Species = { id: string; code: string; name: string };
export type PetMorph = {
  id: string;
  speciesId: string;
  code: string;
  name: string;
};

/** Satu halaman list pet. */
export type PetPage = { items: Pet[]; meta: Meta };

/** Filter, sort, dan paging list pet yang dikirim ke server. `page` mulai dari 1. */
export type PetListQuery = {
  /** Pencarian bebas: nama pet, nomor registrasi, nama/email/telepon pemilik. */
  q?: string;
  speciesId?: string;
  ownerId?: string;
  sort?: PetSort;
  direction?: SortDirection;
  page: number;
  perPage: number;
};

/**
 * Mengubah `PetListQuery` jadi query string API. Nilai kosong dibuang oleh `buildUrl`.
 * Dipanggil dari `listPets`; dites di types.test.ts.
 */
export function petListParams(query: PetListQuery) {
  return {
    q: query.q?.trim(),
    species_id: query.speciesId,
    owner_id: query.ownerId,
    sort: query.sort,
    direction: query.direction,
    page: query.page,
    per_page: query.perPage,
  };
}

/** String desimal API ("38.00") -> angka, atau null bila kosong/bukan angka. */
function decimalFromApi(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Mengubah satu baris API jadi bentuk layar.
 * Backend asli tidak mengirim `actions`: pet yang dikembalikannya selalu milik pemanggil,
 * jadi boleh diubah dan dihapus (backend tetap menolak dengan 422 bila ada entry).
 */
export function fromApi(row: ApiPet): Pet {
  return {
    id: row.uuid,
    name: row.name,
    ownerId: row.owner_uuid ?? null,
    ownerName: row.owner_name ?? "",
    speciesId: row.species_uuid,
    speciesName: row.species_name ?? "",
    morphId: row.morph_uuid,
    morphName: row.morph_name ?? "",
    registrationNumber: row.registration_number ?? "",
    gender: row.gender ?? "",
    birthDate: row.birth_date ?? "",
    heightCm: decimalFromApi(row.height_cm),
    weightGrams: decimalFromApi(row.weight_grams),
    welfareStatus: row.welfare_status,
    actions: row.actions ?? { update: true, delete: true },
  };
}

/**
 * Mengubah `data` dari `GET /pets` jadi `PetPage`.
 * Dua bentuk diterima: `{ items, meta }` (kontrak) dan array datar (backend asli sekarang).
 * Array datar berisi SEMUA pet pemanggil, jadi halamannya dipotong di sini supaya
 * pagination layar tetap jujur. `query` hanya dibaca untuk `page` dan `perPage`.
 */
export function petPageFromApi(
  data: ApiPetList | ApiPet[],
  query: Pick<PetListQuery, "page" | "perPage">,
): PetPage {
  if (Array.isArray(data)) {
    const start = (query.page - 1) * query.perPage;
    return {
      items: data.slice(start, start + query.perPage).map(fromApi),
      meta: {
        currentPage: query.page,
        perPage: query.perPage,
        total: data.length,
        lastPage: Math.max(1, Math.ceil(data.length / query.perPage)),
      },
    };
  }
  return {
    items: data.items.map(fromApi),
    meta: {
      currentPage: data.meta.current_page,
      perPage: data.meta.per_page,
      total: data.meta.total,
      lastPage: data.meta.last_page,
    },
  };
}

export const speciesFromApi = (row: ApiSpecies): Species => ({
  id: row.uuid,
  code: row.code,
  name: row.name,
});

export const morphFromApi = (row: ApiPetMorph): PetMorph => ({
  id: row.uuid,
  speciesId: row.species_uuid,
  code: row.code,
  name: row.name,
});

/**
 * Morph yang boleh dipilih untuk satu spesies (morph milik spesies lain disaring).
 * Spesies kosong -> daftar kosong, karena form baru menampilkan morph setelah spesies dipilih.
 * Dipanggil dari form pet.
 */
export function morphsForSpecies(
  morphs: PetMorph[],
  speciesId: string,
): PetMorph[] {
  if (!speciesId) return [];
  return morphs.filter((morph) => morph.speciesId === speciesId);
}

/**
 * Mengisi `speciesName` dan `morphName` yang masih kosong dari daftar master.
 * Backend asli tidak mengirim nama (hanya uuid), mock mengirimnya; fungsi ini membuat
 * layar sama di kedua mode. Nama yang sudah ada tidak ditimpa. Id tak dikenal tetap kosong.
 */
export function withMasterNames(
  pet: Pet,
  species: Species[],
  morphs: PetMorph[],
): Pet {
  return {
    ...pet,
    speciesName:
      pet.speciesName ||
      species.find((s) => s.id === pet.speciesId)?.name ||
      "",
    morphName:
      pet.morphName || morphs.find((m) => m.id === pet.morphId)?.name || "",
  };
}

/** Baris "Spesies · Morph" di kartu dan header. Bagian kosong dilewati. */
export function speciesMorphLine(
  pet: Pick<Pet, "speciesName" | "morphName">,
): string {
  return [pet.speciesName, pet.morphName].filter(Boolean).join(" · ");
}
