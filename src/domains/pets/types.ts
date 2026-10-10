/** One pet exactly as the API sends it (petpet-service `PetData::toArray`). */
export type ApiPet = {
  uuid: string;
  species_uuid: string | null;
  morph_uuid: string | null;
  registration_number: string | null;
  name: string;
  gender: string | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_grams: number | null;
  welfare_status: string | null;
};

export type Pet = { id: string; name: string; speciesId: string | null };

export const petFromApi = (row: ApiPet): Pet => ({
  id: row.uuid,
  name: row.name,
  speciesId: row.species_uuid,
});
