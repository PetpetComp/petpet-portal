import { rupiah } from "@/lib/format/label";
import type { EventReport, ReportsOverview } from "./types";

/**
 * "12 of 20 paid" -> persen pembayaran tanpa pecahan. Tanpa entry: 0 (hindari bagi nol).
 * Contoh: paidPercent(12, 20) = 60. Dipakai kartu ringkasan dan CSV.
 */
export function paidPercent(paid: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((paid / total) * 100);
}

/** Baris export ringkasan per kompetisi (satu baris per kompetisi, ditutup baris Total). */
export function competitionsCsvRows(
  report: EventReport,
): Record<string, string | number>[] {
  const rows = report.competitions.map((c) => ({
    Competition: c.name,
    Type: c.typeCode,
    Status: c.status,
    Entries: c.entries,
    Paid: c.paidEntries,
    "Checked in": c.checkedIn,
    Revenue: c.revenue,
  }));
  return [
    ...rows,
    {
      Competition: "Total",
      Type: "",
      Status: "",
      Entries: report.totals.entries,
      Paid: report.totals.paidEntries,
      "Checked in": report.totals.checkedIn,
      Revenue: report.totals.revenue,
    },
  ];
}

/** Baris export peserta event (kolom yang berguna untuk panitia, bukan 20 kolom legacy). */
export function participantsCsvRows(
  report: EventReport,
): Record<string, string | number>[] {
  return report.participants.map((p) => ({
    Competition: p.competitionName,
    Bib: p.bibNumber,
    Pet: p.petName,
    Owner: p.ownerName,
    Payment: p.paymentStatus === "PAID" ? "Paid" : "Unpaid",
    "Checked in": p.checkinStatus === "CHECKED_IN" ? "Yes" : "No",
    Fee: p.registrationFee,
    Registered: p.registeredAt,
  }));
}

/** Baris export ringkasan lintas event. */
export function overviewCsvRows(
  overview: ReportsOverview,
): Record<string, string | number>[] {
  return overview.events.map((e) => ({
    Event: e.name,
    Organization: e.organizationName,
    Status: e.status,
    Competitions: e.competitions,
    Entries: e.entries,
    Paid: e.paidEntries,
    Revenue: e.revenue,
  }));
}

/** Nama file export dari nama event: huruf kecil, spasi menjadi tanda hubung. */
export function reportFileName(prefix: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${prefix}-${slug.replace(/^-|-$/g, "")}`;
}

/** Revenue tampil sebagai "Rp 1.250.000". Diekspor agar layar dan tes memakai format yang sama. */
export const revenueLabel = rupiah;
