"use client";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from "react-hook-form";
import { FormField, fieldClass } from "@/components/ui/form-field";
import type { UserFormValues } from "@/domains/users/schema";
import { useCities, useProvinces } from "@/domains/users/queries";
import type { RegionOption } from "@/domains/users/types";

/**
 * Pilihan untuk select: daftar dari server, ditambah nilai tersimpan yang tidak ada di daftar
 * (mis. data lama berupa teks bebas) supaya nilai itu tidak hilang saat form dibuka.
 */
function optionsWith(list: RegionOption[], current: string): string[] {
  const names = list.map((r) => r.name);
  return current && !names.includes(current) ? [current, ...names] : names;
}

/**
 * Dua select bertingkat Province -> City untuk form user (desain UserForm).
 * Profil user menyimpan NAMA provinsi/kota (teks), jadi nilai select = nama, dan uuid
 * hanya dipakai untuk memuat kota. Memilih provinsi lain mengosongkan kota.
 * Bila daftar provinsi gagal dimuat atau kosong, keduanya jatuh ke isian teks supaya
 * form tetap bisa dipakai. Tidak ada kecamatan (tabel district sudah dihapus backend, K4).
 * Dipanggil dari `UserForm`; form dimiliki pemanggil (react-hook-form).
 */
export function RegionFields({
  control,
  errors,
  setValue,
  province,
  city,
}: {
  control: Control<UserFormValues>;
  errors: FieldErrors<UserFormValues>;
  setValue: UseFormSetValue<UserFormValues>;
  /** Nama provinsi yang sedang dipilih (dari `useWatch`). */
  province: string;
  city: string;
}) {
  const provinces = useProvinces();
  const provinceList = provinces.data ?? [];
  const selectedProvince = provinceList.find((p) => p.name === province);
  const cities = useCities(selectedProvince?.id);

  const freeText =
    provinces.isError || (provinces.isSuccess && provinceList.length === 0);

  return (
    <>
      <FormField label="Province" error={errors.province?.message}>
        <Controller
          control={control}
          name="province"
          render={({ field }) =>
            freeText ? (
              <input
                {...field}
                type="text"
                maxLength={100}
                aria-invalid={!!errors.province}
                className={fieldClass}
              />
            ) : (
              <select
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value}
                disabled={provinces.isPending}
                onChange={(e) => {
                  field.onChange(e.target.value);
                  setValue("city", "");
                }}
                aria-invalid={!!errors.province}
                className={fieldClass}
              >
                <option value="">
                  {provinces.isPending ? "Loading..." : "Select province"}
                </option>
                {optionsWith(provinceList, province).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )
          }
        />
      </FormField>
      <FormField label="City" error={errors.city?.message}>
        <Controller
          control={control}
          name="city"
          render={({ field }) =>
            freeText ? (
              <input
                {...field}
                type="text"
                maxLength={100}
                aria-invalid={!!errors.city}
                className={fieldClass}
              />
            ) : (
              <select
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value}
                disabled={!selectedProvince && !city}
                onChange={(e) => field.onChange(e.target.value)}
                aria-invalid={!!errors.city}
                className={fieldClass}
              >
                <option value="">
                  {cities.isPending && selectedProvince
                    ? "Loading..."
                    : selectedProvince
                      ? "Select city"
                      : "Select a province first"}
                </option>
                {optionsWith(cities.data ?? [], city).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )
          }
        />
      </FormField>
    </>
  );
}
