import type { ApiPageMeta } from "@/types/api";
import type { Meta } from "@/types/common";

/**
 * Tipe dan fungsi murni untuk menu Brands (master sponsor), kontrak ada di
 * petpet-docs/_draft-kontrak-brands.md. Dipakai oleh api.ts, queries.ts, dan layar
 * `/sponsorship-brand`. Sengaja terpisah dari `domains/sponsors` (tab Sponsors di event).
 */

/** Nilai `master.sponsors.status` di backend (`SponsorConstant`). */
export const BRAND_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BrandStatus = (typeof BRAND_STATUSES)[number];

/** Satu PIC brand persis seperti response backend (`SponsorData::fromModel`). */
export type ApiBrandPic = {
  user_uuid: string;
  name: string;
  email: string;
};

/**
 * Satu brand persis seperti response `GET /sponsors` (`SponsorData::toArray`).
 * Dua field terakhir BELUM dikirim backend asli (kolom `campaign` dan `instagram_id` ada di
 * tabel tetapi tidak ada di `SponsorData`), jadi bertanda opsional. Mock sudah mengirimnya.
 */
export type ApiBrand = {
  uuid: string;
  brand_name: string;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  status: string;
  pics: ApiBrandPic[];
  campaign?: string | null;
  instagram_id?: string | null;
};

/** `data` dari `GET /sponsors`. */
export type ApiBrandList = { items: ApiBrand[]; meta: ApiPageMeta };

/** Bentuk untuk layar: satu PIC. */
export type BrandPic = {
  userId: string;
  name: string;
  email: string;
};

/** Bentuk untuk layar: satu brand. Dibuat oleh `fromApi` saja. */
export type Brand = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  /** Status mentah dari API. Nilai di luar `BRAND_STATUSES` tetap dipertahankan. */
  status: string;
  pics: BrandPic[];
  /** Slogan kampanye. Null bila backend belum mengirimnya (mode backend asli). */
  campaign: string | null;
  /** Handle Instagram tanpa "@". Null bila backend belum mengirimnya. */
  handle: string | null;
};

/** Satu halaman daftar brand. */
export type BrandPage = { items: Brand[]; meta: Meta };

/** Filter dan paging daftar brand yang dikirim ke server. `page` mulai dari 1. */
export type BrandListQuery = {
  /** Pencarian bebas: nama brand, kampanye, handle. Hanya didukung mock (belum ada di backend). */
  q?: string;
  page: number;
  perPage: number;
};

/** Brand aktif = tampil di daftar dan bisa ditautkan ke event. */
export const isBrandActive = (brand: Brand) => brand.status === "ACTIVE";

/** Label status untuk badge di layar. Status tak dikenal ditampilkan apa adanya. */
export function brandStatusLabel(status: string): string {
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE") return "Inactive";
  return status;
}

/** Satu PIC dari API -> bentuk layar. */
export const picFromApi = (row: ApiBrandPic): BrandPic => ({
  userId: row.user_uuid,
  name: row.name,
  email: row.email,
});

/**
 * Satu brand dari API -> bentuk layar. Dipanggil dari api.ts untuk setiap response.
 * `pics` yang tidak ada dianggap kosong supaya satu field hilang tidak membuat layar error.
 */
export function fromApi(row: ApiBrand): Brand {
  return {
    id: row.uuid,
    name: row.brand_name,
    phone: row.phone,
    email: row.email,
    websiteUrl: row.website_url,
    status: row.status,
    pics: (row.pics ?? []).map(picFromApi),
    campaign: row.campaign ?? null,
    handle: row.instagram_id ?? null,
  };
}

/**
 * Daftar response API -> `BrandPage`. Backend memberi `{ items, meta }` (snake_case);
 * `meta` diubah ke camelCase seperti `Meta` di tipe bersama.
 */
export function brandPageFromApi(data: ApiBrandList): BrandPage {
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

/**
 * `BrandListQuery` -> parameter query string API. Teks kosong dibuang supaya tidak terkirim.
 * Dipanggil dari api.ts.
 */
export function brandListParams(query: BrandListQuery) {
  return {
    q: query.q?.trim() || undefined,
    page: query.page,
    per_page: query.perPage,
  };
}

/**
 * Baris kecil di kartu brand: sisi kiri (handle, atau email bila handle belum ada) dan
 * sisi kanan (telepon). Mengembalikan teks siap tampil; null bila datanya tidak ada.
 * Kenapa fallback email: di mode backend asli handle belum dikirim, kartu tetap berguna.
 */
export function cardContactLines(brand: Brand): {
  left: string | null;
  right: string | null;
} {
  const left = brand.handle ? `@${brand.handle}` : brand.email;
  return { left: left || null, right: brand.phone || null };
}
