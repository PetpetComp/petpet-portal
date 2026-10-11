/**
 * Format tanggal untuk layar kompetisi (zona waktu browser). Logika murni, dites di format.test.ts.
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

const parse = (iso: string): Date | null => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const day = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "4 Sep 2026, 10:30" seperti kolom Opens dan Closes di desain Settings. */
export function formatDayTime(iso: string | null): string {
  const d = iso ? parse(iso) : null;
  return d ? `${day(d)} ${d.getFullYear()}, ${time(d)}` : "-";
}

/**
 * Jendela waktu ringkas untuk kartu Registration & pricing.
 * Satu hari: "4 Sep 2026, 06:30 - 10:30". Beda hari: "12 Jul - 26 Jul 2026"
 * (tahun ikut di kedua ujung bila berbeda).
 */
export function formatWindow(startIso: string, endIso: string): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start || !end) return "-";
  if (sameDay(start, end))
    return `${day(start)} ${start.getFullYear()}, ${time(start)} - ${time(end)}`;
  if (start.getFullYear() !== end.getFullYear())
    return `${day(start)} ${start.getFullYear()} - ${day(end)} ${end.getFullYear()}`;
  return `${day(start)} - ${day(end)} ${end.getFullYear()}`;
}
