/**
 * Format jadwal event untuk layar (zona waktu browser). Logika murni, dites di format.test.ts.
 * Bulan ditulis manual ("Sep") karena Intl en-GB memberi "Sept" di sebagian mesin.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Rentang tanggal ringkas:
 * satu hari "4 Sep 2026", satu bulan "5 – 6 Sep 2026",
 * beda bulan "30 Aug – 2 Sep 2026", beda tahun "30 Dec 2026 – 2 Jan 2027".
 */
export function formatDateRange(start: Date, end: Date): string {
  if (sameDay(start, end))
    return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  if (start.getFullYear() !== end.getFullYear())
    return (
      `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()} – ` +
      `${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    );
  if (start.getMonth() !== end.getMonth())
    return (
      `${start.getDate()} ${MONTHS[start.getMonth()]} – ` +
      `${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    );
  return `${start.getDate()} – ${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
}

/** Jam mulai pertama sampai jam selesai terakhir: "10:00 – 20:00". */
export function formatTimeRange(start: Date, end: Date): string {
  return `${timeOf(start)} – ${timeOf(end)}`;
}

/**
 * Tanggal dan jam event dari dua string ISO. Tanggal tidak valid menghasilkan "-" di kedua bagian.
 * Dipakai kolom Date di list ("date" baris atas, "time" baris bawah) dan header event.
 */
export function formatEventSchedule(
  startIso: string,
  endIso: string,
): { date: string; time: string } {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return { date: "-", time: "-" };
  return {
    date: formatDateRange(start, end),
    time: formatTimeRange(start, end),
  };
}
