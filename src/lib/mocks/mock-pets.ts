import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  PET_SORTS,
  type ApiPet,
  type ApiPetActions,
  type ApiPetList,
  type ApiPetMorph,
} from "@/domains/pets/types";
import { mockAccess } from "./mock-access";
import { forbidUnless } from "./mock-records";
import { nextUuid, store } from "./mock-store";
import type { MockPet, MockUser } from "./mock-types";

/**
 * Backend palsu untuk pet dan master morph. Aturan mengikuti `PetService` backend dan
 * kontrak pets (petpet-docs/_draft-kontrak-pets.md). Dipanggil dari route `/pets*` dan
 * `/master/pet-morphs` di mock-request.ts.
 *
 * Beda dengan backend sekarang (semua dicatat di kontrak):
 * - daftar dipaging/difilter/diurutkan dan membawa nama pemilik, spesies, morph, `actions`;
 * - staf (`user.view`) melihat semua pet, staf pengelola (`user.manage`) boleh mengubah/menghapus
 *   pet orang lain dan membuat pet atas nama user lain lewat `owner_id`;
 * - PATCH menerima `species_id` dan `morph_id`.
 */

/** Hak pemanggil atas pet, dihitung sekali per request dari permission-nya. */
type PetCaller = {
  userUuid: string;
  /** Boleh melihat semua pet (`user.view`). */
  canViewAll: boolean;
  /** Boleh mengubah/menghapus pet orang lain dan membuat atas nama orang lain (`user.manage`). */
  canManageAll: boolean;
};

function petCallerOf(user: MockUser): PetCaller {
  const permissions = mockAccess(user).permissions as string[];
  return {
    userUuid: user.uuid,
    canViewAll: permissions.includes(PERMISSION.USER_VIEW),
    canManageAll: permissions.includes(PERMISSION.USER_MANAGE),
  };
}

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

/** Angka -> string desimal 2 digit seperti `number_format($x, 2, '.', '')` di backend. */
const decimal = (value: number | undefined) =>
  value === undefined ? null : value.toFixed(2);

/** Pet ini punya entry kompetisi (apa pun statusnya), seperti `PetRepository::hasEntries`. */
const hasEntries = (petUuid: string) =>
  store.entries.some((entry) => entry.pet_uuid === petUuid);

/** Pemanggil boleh mengubah/menghapus pet ini: pemilik atau staf pengelola. */
const mayModify = (pet: MockPet, caller: PetCaller) =>
  pet.owner_uuid === caller.userUuid || caller.canManageAll;

function petActions(pet: MockPet, caller: PetCaller): ApiPetActions {
  const allowed = mayModify(pet, caller);
  return { update: allowed, delete: allowed && !hasEntries(pet.uuid) };
}

/** Satu pet sebagai response API (`PetData::toArray` + field kontrak). */
function petRecord(pet: MockPet, caller: PetCaller): ApiPet {
  const owner = store.users.find((u) => u.uuid === pet.owner_uuid);
  const species = store.species.find((s) => s.uuid === pet.species_uuid);
  const morph = store.petMorphs.find((m) => m.uuid === pet.morph_uuid);
  return {
    uuid: pet.uuid,
    species_uuid: pet.species_uuid ?? "",
    morph_uuid: pet.morph_uuid ?? null,
    registration_number: pet.registration_number ?? null,
    name: pet.name,
    gender: pet.gender ?? null,
    birth_date: pet.birth_date ?? null,
    height_cm: decimal(pet.height_cm),
    weight_grams: decimal(pet.weight_grams),
    welfare_status: "PENDING",
    owner_uuid: pet.owner_uuid,
    owner_name: owner ? fullName(owner) : "",
    species_name: species?.name ?? "",
    morph_name: morph?.name ?? null,
    actions: petActions(pet, caller),
  };
}

/** Melempar 422 dengan pesan per field, seperti `ValidationException` Laravel. */
function invalid(errors: Record<string, string[]>): never {
  const first = Object.values(errors)[0]?.[0] ?? "The given data was invalid.";
  throw new ApiError(422, first, errors);
}

/** Pet milik pemanggil, atau semua pet bila staf. Dasar daftar dan detail. */
function visiblePets(caller: PetCaller): MockPet[] {
  return caller.canViewAll
    ? store.pets
    : store.pets.filter((pet) => pet.owner_uuid === caller.userUuid);
}

/** Nilai query yang harus salah satu dari `allowed`; kosong -> undefined; lainnya 422. */
function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === null || value === "") return undefined;
  if (!(allowed as readonly string[]).includes(value))
    invalid({ [field]: [`The selected ${field} is invalid.`] });
  return value as T;
}

/** Teks pencarian cocok ke nama pet, nomor registrasi, atau nama/email/telepon pemilik. */
function matchesSearch(pet: MockPet, needle: string): boolean {
  const owner = store.users.find((u) => u.uuid === pet.owner_uuid);
  return [
    pet.name,
    pet.registration_number ?? "",
    owner ? fullName(owner) : "",
    owner?.email ?? "",
    owner?.phone ?? "",
  ].some((value) => value.toLowerCase().includes(needle));
}

/** Perbandingan nullable: null selalu di belakang. */
const compareNullable = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b);

/**
 * `GET /pets`: `{ items, meta }`. Filter `q`, `species_id`, `owner_id`; `sort` (`name`,
 * `birth_date`) + `direction`; `page`, `per_page` (bawaan 15, maks 100). Pemanggil biasa hanya
 * melihat petnya sendiri, staf (`user.view`) melihat semua.
 */
export function listPetRecords(
  user: MockUser,
  query: URLSearchParams,
): ApiPetList {
  const caller = petCallerOf(user);
  const speciesId = query.get("species_id") || null;
  if (speciesId && !store.species.some((s) => s.uuid === speciesId))
    invalid({ species_id: ["The selected species id is invalid."] });
  const sort = oneOf(query.get("sort"), PET_SORTS, "sort") ?? "name";
  const direction =
    oneOf(query.get("direction"), ["asc", "desc"] as const, "direction") ??
    "asc";
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const perPage = Number(query.get("per_page") ?? 15) || 15;
  if (perPage < 1 || perPage > 100)
    invalid({ per_page: ["The per page may not be greater than 100."] });

  const needle = (query.get("q") ?? "").trim().toLowerCase();
  const ownerId = query.get("owner_id") || null;
  const rows = visiblePets(caller)
    .filter((pet) => !speciesId || pet.species_uuid === speciesId)
    .filter((pet) => !ownerId || pet.owner_uuid === ownerId)
    .filter((pet) => !needle || matchesSearch(pet, needle));

  const factor = direction === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const order =
      sort === "birth_date"
        ? compareNullable(a.birth_date ?? null, b.birth_date ?? null)
        : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return order * factor || a.uuid.localeCompare(b.uuid);
  });

  const start = (page - 1) * perPage;
  return {
    items: rows.slice(start, start + perPage).map((p) => petRecord(p, caller)),
    meta: {
      current_page: page,
      per_page: perPage,
      total: rows.length,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
    },
  };
}

/** `GET /pets/{uuid}`. Urutan: 404 tidak ada, 403 bukan pemilik (dan bukan staf). */
export function getPetRecord(user: MockUser, uuid: string): ApiPet {
  const caller = petCallerOf(user);
  const pet = findPet(uuid);
  forbidUnless(pet.owner_uuid === caller.userUuid || caller.canViewAll);
  return petRecord(pet, caller);
}

function findPet(uuid: string): MockPet {
  const pet = store.pets.find((p) => p.uuid === uuid);
  if (!pet) throw new ApiError(404, "Pet not found.");
  return pet;
}

/** Teks dari body, atau undefined bila kosong/bukan teks. */
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/** Angka >= 0 dari body, null bila kosong, atau 422 bila bukan angka. */
function numberField(
  body: Record<string, unknown>,
  field: string,
): number | undefined | null {
  const raw = body[field];
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed))
    invalid({ [field]: [`The ${field.replace(/_/g, " ")} must be a number.`] });
  if (parsed < 0)
    invalid({
      [field]: [`The ${field.replace(/_/g, " ")} must be at least 0.`],
    });
  return parsed;
}

/** Tanggal "YYYY-MM-DD" yang ada di kalender, null bila kosong, atau 422. */
function dateField(
  body: Record<string, unknown>,
  field: string,
): string | undefined | null {
  const raw = body[field];
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const value = String(raw);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]))
    : null;
  if (!match || !date || date.getUTCMonth() !== +match[2] - 1)
    invalid({ [field]: ["The birth date is not a valid date."] });
  return match[0];
}

/** Teks opsional dengan batas panjang: undefined = tidak dikirim, null = dikosongkan. */
function limitedText(
  body: Record<string, unknown>,
  field: string,
  max: number,
): string | undefined | null {
  const raw = body[field];
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const value = String(raw).trim();
  if (value.length > max)
    invalid({
      [field]: [
        `The ${field.replace(/_/g, " ")} may not be greater than ${max} characters.`,
      ],
    });
  return value || null;
}

/** 422 bila nomor registrasi sudah dipakai pet lain. */
function ensureRegistrationNumberFree(value: string | null, selfUuid?: string) {
  if (
    value &&
    store.pets.some(
      (p) => p.registration_number === value && p.uuid !== selfUuid,
    )
  )
    invalid({
      registration_number: ["The registration number has already been taken."],
    });
}

/** 422 bila spesies tidak ada, atau morph tidak ada / bukan milik spesies itu. */
function ensureClassification(speciesUuid: string, morphUuid: string | null) {
  if (!store.species.some((s) => s.uuid === speciesUuid))
    invalid({ species_id: ["The selected species id is invalid."] });
  if (morphUuid === null) return;
  const morph = store.petMorphs.find((m) => m.uuid === morphUuid);
  if (!morph) invalid({ morph_id: ["The selected morph id is invalid."] });
  if (morph.species_uuid !== speciesUuid)
    invalid({ morph_id: ["This morph does not belong to the given species."] });
}

/**
 * `POST /pets`. Urutan: pemanggil dulu (403 bila `owner_id` orang lain tanpa `user.manage`),
 * lalu data (422): nama wajib, spesies wajib dan ada, morph milik spesies itu, nomor registrasi
 * unik, panjang teks, angka >= 0, tanggal valid, `owner_id` harus user yang ada.
 */
export function createPetRecord(
  user: MockUser,
  body: Record<string, unknown> | undefined,
): ApiPet {
  const caller = petCallerOf(user);
  const input = body ?? {};
  const ownerId = text(input.owner_id);
  if (ownerId && ownerId !== user.uuid) forbidUnless(caller.canManageAll);

  const name = text(input.name);
  if (!name) invalid({ name: ["The name field is required."] });
  if (name.length > 150)
    invalid({ name: ["The name may not be greater than 150 characters."] });
  const speciesUuid = text(input.species_id);
  if (!speciesUuid)
    invalid({ species_id: ["The species id field is required."] });
  const morphUuid = text(input.morph_id) ?? null;
  ensureClassification(speciesUuid, morphUuid);
  if (ownerId && !store.users.some((u) => u.uuid === ownerId))
    invalid({ owner_id: ["The selected owner id is invalid."] });

  const registrationNumber = limitedText(input, "registration_number", 100);
  ensureRegistrationNumberFree(registrationNumber ?? null);
  const gender = limitedText(input, "gender", 20);
  const birthDate = dateField(input, "birth_date");
  const heightCm = numberField(input, "height_cm");
  const weightGrams = numberField(input, "weight_grams");

  const pet: MockPet = {
    uuid: nextUuid(),
    owner_uuid: ownerId ?? user.uuid,
    name,
    species_uuid: speciesUuid,
    morph_uuid: morphUuid ?? undefined,
    registration_number: registrationNumber ?? undefined,
    gender: gender ?? undefined,
    birth_date: birthDate ?? undefined,
    height_cm: heightCm ?? undefined,
    weight_grams: weightGrams ?? undefined,
    status: "Active",
  };
  store.pets.push(pet);
  return petRecord(pet, caller);
}

/**
 * `PATCH /pets/{uuid}`. Urutan: 404, 403 (bukan pemilik dan bukan `user.manage`), lalu 422.
 * Hanya field yang ada di body yang diubah; `null` mengosongkan field opsional.
 * `species_id` dan `morph_id` boleh diubah di mock (backend sekarang tidak menerimanya),
 * dengan aturan konsistensi yang sama seperti create.
 */
export function updatePetRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiPet {
  const caller = petCallerOf(user);
  const pet = findPet(uuid);
  forbidUnless(mayModify(pet, caller));
  const input = body ?? {};

  if ("name" in input) {
    const name = text(input.name);
    if (!name) invalid({ name: ["The name field is required."] });
    if (name.length > 150)
      invalid({ name: ["The name may not be greater than 150 characters."] });
  }
  const nextSpecies = text(input.species_id) ?? pet.species_uuid ?? "";
  const nextMorph =
    "morph_id" in input
      ? (text(input.morph_id) ?? null)
      : (pet.morph_uuid ?? null);
  // Spesies berganti tanpa morph baru: morph lama pasti salah spesies, jadi 422 di morph_id.
  if ("species_id" in input || "morph_id" in input)
    ensureClassification(nextSpecies, nextMorph);

  const registrationNumber = limitedText(input, "registration_number", 100);
  ensureRegistrationNumberFree(registrationNumber ?? null, pet.uuid);
  const gender = limitedText(input, "gender", 20);
  const birthDate = dateField(input, "birth_date");
  const heightCm = numberField(input, "height_cm");
  const weightGrams = numberField(input, "weight_grams");

  if ("name" in input) pet.name = text(input.name) as string;
  if ("species_id" in input || "morph_id" in input) {
    pet.species_uuid = nextSpecies;
    pet.morph_uuid = nextMorph ?? undefined;
  }
  if (registrationNumber !== undefined)
    pet.registration_number = registrationNumber ?? undefined;
  if (gender !== undefined) pet.gender = gender ?? undefined;
  if (birthDate !== undefined) pet.birth_date = birthDate ?? undefined;
  if (heightCm !== undefined) pet.height_cm = heightCm ?? undefined;
  if (weightGrams !== undefined) pet.weight_grams = weightGrams ?? undefined;
  return petRecord(pet, caller);
}

/**
 * `DELETE /pets/{uuid}`. Urutan: 404, 403 (bukan pemilik dan bukan `user.manage`),
 * 422 bila pet punya entry kompetisi ("This pet has competition entries and cannot be deleted.").
 */
export function deletePetRecord(user: MockUser, uuid: string): null {
  const caller = petCallerOf(user);
  const pet = findPet(uuid);
  forbidUnless(mayModify(pet, caller));
  if (hasEntries(pet.uuid))
    throw new ApiError(
      422,
      "This pet has competition entries and cannot be deleted.",
    );
  store.pets = store.pets.filter((item) => item.uuid !== uuid);
  return null;
}

/** Kode morph tiruan dari namanya ("Classic Grey" -> "CLASSIC_GREY"); seed mock tidak menyimpan kode. */
const morphCode = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/**
 * `GET /master/pet-morphs`: array datar `{ uuid, species_uuid, code, name }`, urut nama.
 * `species_id` menyaring; 404 bila spesies tidak ada (seperti `firstOrFail` di backend).
 */
export function listPetMorphRecords(query: URLSearchParams): ApiPetMorph[] {
  const speciesId = query.get("species_id");
  if (speciesId && !store.species.some((s) => s.uuid === speciesId))
    throw new ApiError(404, "Species not found.");
  return store.petMorphs
    .filter((morph) => !speciesId || morph.species_uuid === speciesId)
    .map((morph) => ({
      uuid: morph.uuid,
      species_uuid: morph.species_uuid,
      code: morphCode(morph.name),
      name: morph.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
