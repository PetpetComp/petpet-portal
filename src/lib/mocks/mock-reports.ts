import { PERMISSION } from "@/lib/auth/permissions";
import type {
  ApiEventReport,
  ApiEventReportCompetition,
  ApiEventReportParticipant,
  ApiOverviewEvent,
  ApiReportsOverview,
} from "@/domains/reports/types";
import { callerFor, forbidUnless, hasPermission } from "./mock-records";
import { findOrThrow, store } from "./mock-store";
import type { MockEntry, MockUser } from "./mock-types";

/**
 * Backend palsu untuk Reports (kontrak petpet-docs/13-kontrak-api-mock.md, bagian Reports).
 * Backend asli belum punya endpoint ini. Angka dihitung di sini dari data yang sama dengan
 * Registrations dan Participants, jadi laporan selalu cocok dengan tab-tab itu.
 * Aturan hitung: entry REGISTERED saja (yang WITHDRAWN tidak ikut), Paid = payment_status PAID,
 * Revenue = jumlah `registration_fee` entry Paid, Checked in = checkin_status CHECKED_IN.
 * Akses: butuh mengelola event dan `event.update` (sama dengan menu Reports).
 */

const fullName = (user: MockUser) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;

/** Entry yang dihitung di laporan: yang masih terdaftar. */
const countable = (entry: MockEntry) => entry.status === "REGISTERED";

/** Jumlah, paid, checked in, dan revenue dari sekelompok entry. */
function tally(entries: MockEntry[]) {
  const paid = entries.filter((e) => e.payment_status === "PAID");
  return {
    entries: entries.length,
    paid_entries: paid.length,
    checked_in: entries.filter((e) => e.checkin_status === "CHECKED_IN").length,
    revenue: paid.reduce((sum, e) => sum + e.registration_fee, 0),
  };
}

/** Entry yang dihitung untuk satu kompetisi. */
const entriesOfCompetition = (competitionUuid: string) =>
  store.entries.filter(
    (e) => e.competition_uuid === competitionUuid && countable(e),
  );

/** True bila pemanggil boleh membaca laporan event ini. */
function canReport(user: MockUser, eventUuid: string): boolean {
  const caller = callerFor(user, eventUuid);
  return caller.managesEvent && hasPermission(caller, PERMISSION.EVENT_UPDATE);
}

/** Satu entry menjadi baris export peserta. */
function participantRow(entry: MockEntry): ApiEventReportParticipant {
  const competition = findOrThrow(
    store.competitions,
    entry.competition_uuid,
    "Competition",
  );
  const owner = findOrThrow(store.users, entry.owner_uuid, "User");
  const pet = entry.pet_uuid
    ? store.pets.find((p) => p.uuid === entry.pet_uuid)
    : undefined;
  return {
    entry_uuid: entry.uuid,
    competition_name: competition.name,
    bib_number: entry.bib_number,
    pet_name: pet?.name ?? null,
    owner_name: fullName(owner),
    payment_status: entry.payment_status,
    checkin_status: entry.checkin_status,
    registration_fee: entry.registration_fee,
    registered_at: entry.registered_at,
  };
}

/**
 * `GET /events/{uuid}/report`. Urutan cek: 404 event, 403 (bukan pengelola event).
 * Kompetisi diurut menurut nama; peserta menurut waktu daftar terbaru.
 */
export function getEventReportRecord(
  user: MockUser,
  eventUuid: string,
): ApiEventReport {
  findOrThrow(store.events, eventUuid, "Event");
  forbidUnless(canReport(user, eventUuid));
  const competitions = store.competitions
    .filter((c) => c.event_uuid === eventUuid)
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows: ApiEventReportCompetition[] = competitions.map((c) => ({
    competition_uuid: c.uuid,
    name: c.name,
    type_code:
      store.competitionTypes.find((t) => t.uuid === c.competition_type_uuid)
        ?.code ?? "",
    status: c.status,
    ...tally(entriesOfCompetition(c.uuid)),
  }));
  const all = competitions.flatMap((c) => entriesOfCompetition(c.uuid));
  const totals = tally(all);
  return {
    event_uuid: eventUuid,
    totals: {
      competitions: competitions.length,
      entries: totals.entries,
      paid_entries: totals.paid_entries,
      unpaid_entries: totals.entries - totals.paid_entries,
      checked_in: totals.checked_in,
      revenue: totals.revenue,
      sponsors: store.eventSponsors.filter((s) => s.event_uuid === eventUuid)
        .length,
    },
    competitions: rows,
    participants: all
      .map(participantRow)
      .sort((a, b) => b.registered_at.localeCompare(a.registered_at)),
  };
}

/**
 * `GET /reports/overview`. Hanya event yang boleh dikelola pemanggil (super admin: semua);
 * pemanggil tanpa event yang dikelola mendapat daftar kosong. 403 bila tidak punya `event.update`
 * di satu pun event. Event diurut menurut nama.
 */
export function getReportsOverviewRecord(user: MockUser): ApiReportsOverview {
  const events = store.events
    .filter((event) => canReport(user, event.uuid))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows: ApiOverviewEvent[] = events.map((event) => {
    const competitions = store.competitions.filter(
      (c) => c.event_uuid === event.uuid,
    );
    const stats = tally(
      competitions.flatMap((c) => entriesOfCompetition(c.uuid)),
    );
    return {
      event_uuid: event.uuid,
      name: event.name,
      organization_name:
        store.organizations.find((o) => o.uuid === event.organization_uuid)
          ?.name ?? "-",
      status: event.status,
      competitions: competitions.length,
      entries: stats.entries,
      paid_entries: stats.paid_entries,
      revenue: stats.revenue,
    };
  });
  forbidUnless(rows.length > 0 || canViewAnything(user));
  return {
    totals: {
      events: rows.length,
      competitions: rows.reduce((sum, r) => sum + r.competitions, 0),
      entries: rows.reduce((sum, r) => sum + r.entries, 0),
      paid_entries: rows.reduce((sum, r) => sum + r.paid_entries, 0),
      revenue: rows.reduce((sum, r) => sum + r.revenue, 0),
    },
    events: rows,
  };
}

/** Pemanggil yang punya `event.update` di event mana pun boleh membuka halaman (daftar bisa kosong). */
function canViewAnything(user: MockUser): boolean {
  return store.events.some((event) => {
    const caller = callerFor(user, event.uuid);
    return hasPermission(caller, PERMISSION.EVENT_UPDATE);
  });
}
