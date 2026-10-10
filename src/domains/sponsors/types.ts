/**
 * Tipe dan fungsi murni untuk sponsor event (kontrak 13 bagian 4).
 * Backend memberi dua daftar terpisah: tautan event-sponsor (tanpa nama brand) dan daftar brand.
 * File ini menggabungkan keduanya dan mengelompokkannya per tier untuk tab Sponsors.
 */

/** Tier sponsor sesuai backend `EventSponsorConstant::LEVELS`, urut dari yang tertinggi. */
export const SPONSOR_LEVELS = [
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "MEDIA_PARTNER",
] as const;
export type SponsorLevel = (typeof SPONSOR_LEVELS)[number];

export const SPONSOR_LEVEL_LABEL: Record<SponsorLevel, string> = {
  PLATINUM: "Platinum",
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
  MEDIA_PARTNER: "Media partner",
};

/** Satu tautan event-sponsor persis seperti response API (`EventSponsorData::toArray`). */
export type ApiEventSponsor = {
  uuid: string;
  event_uuid: string;
  sponsor_uuid: string;
  sponsorship_level: string;
  campaign_text: string | null;
  display_order: number;
  start_at: string | null;
  end_at: string | null;
  status: string;
};

/** Satu brand persis seperti response `GET /sponsors` (`SponsorData::toArray`). */
export type ApiSponsor = {
  uuid: string;
  brand_name: string;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  status: string;
  pics: { user_uuid: string; name: string; email: string }[];
};

/** Bentuk untuk layar: tautan event-sponsor. */
export type EventSponsorLink = {
  id: string;
  eventId: string;
  brandId: string;
  /** Tier mentah dari API. Nilai di luar daftar tetap dipertahankan supaya tidak hilang. */
  level: string;
  campaignText: string | null;
  displayOrder: number;
};

/** Bentuk untuk layar: brand. */
export type Brand = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

/** Satu sponsor di tab: tautan + data brand yang sudah digabung. */
export type EventSponsor = {
  /** id tautan event-sponsor (dipakai untuk hapus dan ubah tier) */
  linkId: string;
  brandId: string;
  level: string;
  brandName: string;
  phone: string | null;
  displayOrder: number;
};

/** Sponsor satu tier, siap ditampilkan sebagai satu grup. */
export type SponsorGroup = { level: string; sponsors: EventSponsor[] };

/** Nama pengganti bila brand sebuah tautan tidak ada di daftar brand. */
export const UNKNOWN_BRAND = "Unknown brand";

export const linkFromApi = (row: ApiEventSponsor): EventSponsorLink => ({
  id: row.uuid,
  eventId: row.event_uuid,
  brandId: row.sponsor_uuid,
  level: row.sponsorship_level,
  campaignText: row.campaign_text,
  displayOrder: row.display_order,
});

export const brandFromApi = (row: ApiSponsor): Brand => ({
  id: row.uuid,
  name: row.brand_name,
  phone: row.phone,
  email: row.email,
});

/** Label tier untuk layar. Tier yang tidak dikenal ditampilkan apa adanya. */
export function levelLabel(level: string): string {
  return SPONSOR_LEVEL_LABEL[level as SponsorLevel] ?? level;
}

/**
 * Menggabungkan tautan dengan data brand lewat `brandId`.
 * Dipanggil dari `useEventSponsorTeam`. Brand yang tidak ketemu diberi nama `UNKNOWN_BRAND`
 * supaya satu data yang hilang tidak merusak seluruh daftar.
 */
export function joinSponsors(
  links: EventSponsorLink[],
  brands: Brand[],
): EventSponsor[] {
  const byId = new Map(brands.map((brand) => [brand.id, brand]));
  return links.map((link) => {
    const brand = byId.get(link.brandId);
    return {
      linkId: link.id,
      brandId: link.brandId,
      level: link.level,
      brandName: brand?.name ?? UNKNOWN_BRAND,
      phone: brand?.phone ?? null,
      displayOrder: link.displayOrder,
    };
  });
}

/**
 * Mengelompokkan sponsor per tier. Urutan grup mengikuti `SPONSOR_LEVELS`, tier kosong
 * dibuang, tier tak dikenal ditaruh paling akhir. Di dalam grup: `displayOrder`, lalu nama.
 */
export function groupByLevel(sponsors: EventSponsor[]): SponsorGroup[] {
  const known: string[] = [...SPONSOR_LEVELS];
  const unknownLevels = [
    ...new Set(sponsors.map((s) => s.level).filter((l) => !known.includes(l))),
  ];
  return [...known, ...unknownLevels]
    .map((level) => ({
      level,
      sponsors: sponsors
        .filter((s) => s.level === level)
        .sort(
          (a, b) =>
            a.displayOrder - b.displayOrder ||
            a.brandName.localeCompare(b.brandName),
        ),
    }))
    .filter((group) => group.sponsors.length > 0);
}

/** Brand yang belum terhubung ke event (pilihan di drawer Add sponsor), urut nama. */
export function unlinkedBrands(
  brands: Brand[],
  links: EventSponsorLink[],
): Brand[] {
  const linked = new Set(links.map((link) => link.brandId));
  return brands
    .filter((brand) => !linked.has(brand.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Huruf pertama (dua kata pertama) untuk avatar kartu, contoh "Happy Tail Nutrition" -> "HT". */
export function brandInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase());
  return letters.join("") || "?";
}
