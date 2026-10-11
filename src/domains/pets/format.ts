/**
 * Format tampilan pet: umur, berat, tinggi, inisial, dan warna avatar.
 * Logika murni tanpa React, dipakai kartu list, header detail, dan form.
 */

/**
 * Umur singkat dari tanggal lahir "YYYY-MM-DD", contoh "3 yrs", "1 yr", "5 mos".
 * Di bawah satu bulan hasilnya "< 1 mo". Tanggal kosong, rusak, atau di masa depan -> "".
 * `now` bisa diganti di tes. Tanggal dibaca per bagian (bukan `new Date(string)`) supaya
 * tidak bergeser karena zona waktu.
 */
export function petAgeLabel(birthDate: string, now: Date = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return "";
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  let months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  if (now.getDate() < day) months -= 1;
  if (months < 0) return "";
  if (months < 1) return "< 1 mo";
  if (months < 12) return `${months} ${months === 1 ? "mo" : "mos"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "yr" : "yrs"}`;
}

/** Angka dengan paling banyak satu desimal tanpa nol di belakang: 130 -> "130", 4.25 -> "4.3". */
function compactNumber(value: number): string {
  return String(Number(value.toFixed(1)));
}

/**
 * Berat dari gram. Backend menyimpan gram (spesies kecil seperti sugar glider),
 * jadi di bawah 1000 g tampil "130 g", selebihnya "1.2 kg". Null -> "".
 */
export function formatWeight(grams: number | null): string {
  if (grams === null) return "";
  if (grams < 1000) return `${compactNumber(grams)} g`;
  return `${compactNumber(grams / 1000)} kg`;
}

/** Tinggi/panjang dalam cm: 12 -> "12 cm". Null -> "". */
export function formatHeight(cm: number | null): string {
  return cm === null ? "" : `${compactNumber(cm)} cm`;
}

/** Baris kanan bawah kartu: "3 yrs · 130 g". Bagian kosong dilewati; semuanya kosong -> "-". */
export function ageWeightLine(
  pet: { birthDate: string; weightGrams: number | null },
  now: Date = new Date(),
): string {
  const parts = [
    petAgeLabel(pet.birthDate, now),
    formatWeight(pet.weightGrams),
  ];
  return parts.filter(Boolean).join(" · ") || "-";
}

/** Satu huruf untuk avatar ("Mochi" -> "M"). Nama kosong -> "?". */
export function petInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Pasangan warna avatar (latar + huruf) dari token `globals.css`, semuanya literal supaya
 * Tailwind mengenalinya. Desain mewarnai per spesies (anjing oranye, kucing indigo).
 */
const AVATAR_TONES = [
  "bg-event-day-soft text-event-day-ink",
  "bg-upcoming-soft text-upcoming",
  "bg-time-trial-soft text-time-trial-ink",
  "bg-done-soft text-done",
] as const;

/**
 * Kelas warna avatar untuk satu spesies. Kunci yang sama selalu memberi warna yang sama,
 * jadi semua pet satu spesies berwarna sama. `key` biasanya nama spesies; kosong -> warna pertama.
 */
export function avatarTone(key: string): string {
  let sum = 0;
  for (const char of key) sum += char.charCodeAt(0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}
