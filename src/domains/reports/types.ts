/**
 * Tipe domain Reports. Kontrak ada di petpet-docs/13-kontrak-api-mock.md (bagian Reports).
 * Backend belum punya endpoint ini; angka dihitung di server (mock), bukan di layar, supaya
 * layar tidak perlu memuat semua entry hanya untuk menjumlahkan.
 *
 * Aturan hitung (satu tempat, dipegang backend/mock):
 * - Entry yang dihitung: status REGISTERED (yang mundur/WITHDRAWN tidak ikut).
 * - Paid = payment_status PAID. Revenue = jumlah `registration_fee` entry yang Paid.
 * - Checked in = checkin_status CHECKED_IN.
 */

/** Satu baris ringkasan per kompetisi dalam laporan event. */
export type ApiEventReportCompetition = {
  competition_uuid: string;
  name: string;
  type_code: string;
  status: string;
  entries: number;
  paid_entries: number;
  checked_in: number;
  revenue: number;
};

/** Satu entry untuk export peserta (hanya kolom yang berguna di laporan, bukan 20 kolom legacy). */
export type ApiEventReportParticipant = {
  entry_uuid: string;
  competition_name: string;
  bib_number: string | null;
  pet_name: string | null;
  owner_name: string;
  payment_status: "UNPAID" | "PAID";
  checkin_status: "NOT_CHECKED_IN" | "CHECKED_IN";
  registration_fee: number;
  registered_at: string;
};

/** `data` dari `GET /events/{uuid}/report`. */
export type ApiEventReport = {
  event_uuid: string;
  totals: {
    competitions: number;
    entries: number;
    paid_entries: number;
    unpaid_entries: number;
    checked_in: number;
    revenue: number;
    sponsors: number;
  };
  competitions: ApiEventReportCompetition[];
  participants: ApiEventReportParticipant[];
};

/** Satu baris event dalam ringkasan lintas event. */
export type ApiOverviewEvent = {
  event_uuid: string;
  name: string;
  organization_name: string;
  status: string;
  competitions: number;
  entries: number;
  paid_entries: number;
  revenue: number;
};

/** `data` dari `GET /reports/overview`: hanya event yang boleh dikelola pemanggil. */
export type ApiReportsOverview = {
  totals: {
    events: number;
    competitions: number;
    entries: number;
    paid_entries: number;
    revenue: number;
  };
  events: ApiOverviewEvent[];
};

/** Bentuk untuk layar (camelCase). */
export type EventReport = {
  eventId: string;
  totals: {
    competitions: number;
    entries: number;
    paidEntries: number;
    unpaidEntries: number;
    checkedIn: number;
    revenue: number;
    sponsors: number;
  };
  competitions: {
    competitionId: string;
    name: string;
    typeCode: string;
    status: string;
    entries: number;
    paidEntries: number;
    checkedIn: number;
    revenue: number;
  }[];
  participants: {
    entryId: string;
    competitionName: string;
    bibNumber: string;
    petName: string;
    ownerName: string;
    paymentStatus: "UNPAID" | "PAID";
    checkinStatus: "NOT_CHECKED_IN" | "CHECKED_IN";
    registrationFee: number;
    registeredAt: string;
  }[];
};

export type ReportsOverview = {
  totals: {
    events: number;
    competitions: number;
    entries: number;
    paidEntries: number;
    revenue: number;
  };
  events: {
    eventId: string;
    name: string;
    organizationName: string;
    status: string;
    competitions: number;
    entries: number;
    paidEntries: number;
    revenue: number;
  }[];
};

/** Mengubah respons laporan event ke bentuk layar. Dipanggil dari api.ts. */
export function eventReportFromApi(data: ApiEventReport): EventReport {
  return {
    eventId: data.event_uuid,
    totals: {
      competitions: data.totals.competitions,
      entries: data.totals.entries,
      paidEntries: data.totals.paid_entries,
      unpaidEntries: data.totals.unpaid_entries,
      checkedIn: data.totals.checked_in,
      revenue: data.totals.revenue,
      sponsors: data.totals.sponsors,
    },
    competitions: data.competitions.map((c) => ({
      competitionId: c.competition_uuid,
      name: c.name,
      typeCode: c.type_code,
      status: c.status,
      entries: c.entries,
      paidEntries: c.paid_entries,
      checkedIn: c.checked_in,
      revenue: c.revenue,
    })),
    participants: data.participants.map((p) => ({
      entryId: p.entry_uuid,
      competitionName: p.competition_name,
      bibNumber: p.bib_number ?? "",
      petName: p.pet_name ?? "Unnamed pet",
      ownerName: p.owner_name,
      paymentStatus: p.payment_status,
      checkinStatus: p.checkin_status,
      registrationFee: p.registration_fee,
      registeredAt: p.registered_at,
    })),
  };
}

/** Mengubah respons ringkasan lintas event ke bentuk layar. Dipanggil dari api.ts. */
export function overviewFromApi(data: ApiReportsOverview): ReportsOverview {
  return {
    totals: {
      events: data.totals.events,
      competitions: data.totals.competitions,
      entries: data.totals.entries,
      paidEntries: data.totals.paid_entries,
      revenue: data.totals.revenue,
    },
    events: data.events.map((e) => ({
      eventId: e.event_uuid,
      name: e.name,
      organizationName: e.organization_name,
      status: e.status,
      competitions: e.competitions,
      entries: e.entries,
      paidEntries: e.paid_entries,
      revenue: e.revenue,
    })),
  };
}
