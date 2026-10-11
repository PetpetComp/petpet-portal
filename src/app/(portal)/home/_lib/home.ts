/**
 * Logika murni Home (tanpa React). Dipanggil dari `home-page.tsx` dan `upcoming-card.tsx`,
 * dites lewat `home-page.test.tsx` dan `home.test.ts`.
 */

/** Siapa yang membuka Home: menentukan tampilan atau pengalihan. */
export type HomeAudience = "loading" | "organizer" | "staff" | "none";

/**
 * Menentukan tampilan Home.
 * Input: profil akses sudah dimuat atau belum, apakah akun punya hak kelola event/platform,
 * dan jumlah penugasan staf. Output: `loading` (tunggu profil), `organizer` (Home penuh),
 * `staff` (hanya punya penugasan, dialihkan ke My assignments), atau `none` (belum ada peran).
 * Kenapa: staf dan juri tidak boleh melihat Home organizer (keputusan D14), tetapi
 * organizer yang kebetulan juga bertugas di event lain tetap memakai Home.
 */
export function homeAudience(input: {
  loading: boolean;
  isManager: boolean;
  assignmentCount: number;
}): HomeAudience {
  if (input.loading) return "loading";
  if (input.isManager) return "organizer";
  return input.assignmentCount > 0 ? "staff" : "none";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Teks jarak ke event berikutnya: "tomorrow" atau "in 3 days", dihitung per hari kalender
 * di zona waktu pengguna. Dipakai di kartu "Coming up". Tanggal tidak valid menghasilkan "".
 */
export function daysUntilLabel(startIso: string, now: Date): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "";
  const dayOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayOf(start) - dayOf(now)) / DAY_MS);
  if (days <= 0) return "today";
  return days === 1 ? "tomorrow" : `in ${days} days`;
}
