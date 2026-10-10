import { ApiError } from "@/lib/api-client";
import { PERMISSION } from "@/lib/auth/permissions";
import {
  EVENT_PHASES,
  EVENT_SORTS,
  type ApiEvent,
  type ApiEventList,
  type ApiEventSummary,
  type EventPhase,
} from "@/domains/events/types";
import { mockAccess } from "./mock-access";
import { callerFor, forbidUnless, guard, hasPermission } from "./mock-records";
import { findOrThrow, nextUuid, paginate, store } from "./mock-store";
import type { MockEvent, MockUser } from "./mock-types";

/**
 * Backend palsu untuk event: aturan fase, kode, filter list, validasi, dan aksi.
 * Bentuk response mengikuti kontrak 13 bagian 1 (petpet-docs). Dipanggil dari route
 * `/events*` di mock-request.ts. Aturan di sini adalah yang HARUS dikerjakan backend asli.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Fase event dari status + tanggal. Event Cancelled dan Draft tidak melihat tanggal.
 * Event terbit: EVENT_DAY bila hari ini ada di antara tanggal mulai dan selesai
 * (per hari, zona waktu server), UPCOMING bila mulai sesudah hari ini, selain itu FINISHED.
 */
export function eventPhase(
  event: Pick<MockEvent, "status" | "start_at" | "end_at">,
  now: Date,
): EventPhase {
  if (event.status === "CANCELLED") return "CANCELLED";
  if (event.status === "DRAFT") return "DRAFT";
  const dayStart = startOfDay(now).getTime();
  const dayEnd = dayStart + DAY_MS;
  if (new Date(event.start_at).getTime() >= dayEnd) return "UPCOMING";
  if (new Date(event.end_at).getTime() < dayStart) return "FINISHED";
  return "EVENT_DAY";
}

/** Kode tampil "EVT-2026-0002": tahun mulai + nomor urut event (urutan simpan, mulai 1). */
export function eventCode(event: MockEvent): string {
  const sequence = store.events.indexOf(event) + 1;
  const year = new Date(event.start_at).getFullYear();
  return `EVT-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Satu event sebagai response API (`ApiEvent`), lengkap dengan field kontrak 13. */
export function eventRecord(event: MockEvent, now = new Date()): ApiEvent {
  const organization = store.organizations.find(
    (o) => o.uuid === event.organization_uuid,
  );
  return {
    uuid: event.uuid,
    organization_uuid: event.organization_uuid,
    name: event.name,
    slug: event.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    tagline: event.tagline ?? null,
    description: event.description ?? null,
    venue_name: event.venue_name ?? null,
    venue_address: event.venue_address ?? null,
    map_location: event.map_location ?? null,
    timezone: event.timezone ?? "Asia/Jakarta",
    start_at: event.start_at,
    end_at: event.end_at,
    status: event.status,
    code: eventCode(event),
    organization_name: organization?.name ?? "",
    phase: eventPhase(event, now),
  };
}

const includes = (haystack: (string | undefined)[], needle: string) =>
  haystack.some((text) => (text ?? "").toLowerCase().includes(needle));

/** True bila jadwal event menyentuh bulan "YYYY-MM" (zona waktu server). */
function touchesMonth(event: MockEvent, month: string): boolean {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return true;
  const monthStart = new Date(year, monthNumber - 1, 1).getTime();
  const monthEnd = new Date(year, monthNumber, 1).getTime();
  return (
    new Date(event.start_at).getTime() < monthEnd &&
    new Date(event.end_at).getTime() >= monthStart
  );
}

/**
 * `GET /events`: filter `q`, `name`, `venue`, `month`, `organization_id`, `phase`, sort, paging,
 * dan `summary` (jumlah per tab atas semua filter kecuali `phase`). Lihat kontrak 13 bagian 1.
 */
export function listEventRecords(
  query: URLSearchParams,
  now = new Date(),
): ApiEventList {
  const q = (query.get("q") ?? "").trim().toLowerCase();
  const name = (query.get("name") ?? "").trim().toLowerCase();
  const venue = (query.get("venue") ?? "").trim().toLowerCase();
  const month = query.get("month") ?? "";
  const organizationId = query.get("organization_id");
  const phase = query.get("phase");
  if (phase && !EVENT_PHASES.includes(phase as EventPhase))
    throw new ApiError(422, "The selected phase is invalid.", {
      phase: ["The selected phase is invalid."],
    });

  const withoutPhase = store.events.filter((event) => {
    const organizationName = store.organizations.find(
      (o) => o.uuid === event.organization_uuid,
    )?.name;
    if (organizationId && event.organization_uuid !== organizationId)
      return false;
    if (
      q &&
      !includes(
        [
          event.name,
          eventCode(event),
          event.venue_name,
          event.venue_address,
          organizationName,
        ],
        q,
      )
    )
      return false;
    if (name && !includes([event.name, eventCode(event)], name)) return false;
    if (venue && !includes([event.venue_name, event.venue_address], venue))
      return false;
    if (month && !touchesMonth(event, month)) return false;
    return true;
  });

  const phaseOf = (event: MockEvent) => eventPhase(event, now);
  const summary: ApiEventSummary = {
    all: withoutPhase.length,
    event_day: withoutPhase.filter((e) => phaseOf(e) === "EVENT_DAY").length,
    upcoming: withoutPhase.filter((e) => phaseOf(e) === "UPCOMING").length,
    draft: withoutPhase.filter((e) => phaseOf(e) === "DRAFT").length,
    finished: withoutPhase.filter((e) => phaseOf(e) === "FINISHED").length,
  };

  const sort = query.get("sort") ?? "start_at";
  if (!EVENT_SORTS.includes(sort as (typeof EVENT_SORTS)[number]))
    throw new ApiError(422, "The selected sort is invalid.");
  const direction =
    query.get("direction") ?? (sort === "start_at" ? "desc" : "asc");
  const factor = direction === "asc" ? 1 : -1;
  const filtered = withoutPhase
    .filter((event) => !phase || phaseOf(event) === phase)
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name) * factor
        : (new Date(a.start_at).getTime() - new Date(b.start_at).getTime()) *
          factor,
    );

  const page = paginate(
    filtered.map((event) => eventRecord(event, now)),
    query,
  );
  return { ...page, summary };
}

/** Pesan 422 per field, seperti validasi Laravel. */
function invalid(errors: Record<string, string[]>): never {
  throw new ApiError(422, Object.values(errors).flat().join(" "), errors);
}

/**
 * Validasi isi event (create dan update). `current` = event yang sedang diedit (null saat create),
 * dipakai untuk mengabaikan nama event itu sendiri dan untuk menggabungkan tanggal lama.
 * Aturan: nama wajib dan unik (tanpa membedakan huruf besar/kecil), selesai setelah mulai.
 */
function validateDetails(
  body: Record<string, unknown> | undefined,
  current: MockEvent | null,
) {
  const errors: Record<string, string[]> = {};
  const name = body?.name !== undefined ? String(body.name).trim() : undefined;
  if (current === null && !name) errors.name = ["The name field is required."];
  else if (name !== undefined && !name)
    errors.name = ["The name field is required."];
  else if (name) {
    const taken = store.events.some(
      (e) =>
        e.uuid !== current?.uuid && e.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) errors.name = ["An event with this name already exists."];
  }
  const start = body?.start_at ?? current?.start_at;
  const end = body?.end_at ?? current?.end_at;
  if (!start) errors.start_at = ["The start at field is required."];
  if (!end) errors.end_at = ["The end at field is required."];
  if (start && end && new Date(String(end)) <= new Date(String(start)))
    errors.end_at = ["The end at must be after start at."];
  if (Object.keys(errors).length) invalid(errors);
}

const DETAIL_FIELDS = [
  "name",
  "tagline",
  "description",
  "venue_name",
  "venue_address",
  "map_location",
  "timezone",
  "start_at",
  "end_at",
] as const;

/** Menyalin hanya field isi event yang dikenal dari body (bukan status/organisasi). */
function applyDetails(event: MockEvent, body: Record<string, unknown>) {
  const target = event as unknown as Record<string, unknown>;
  for (const field of DETAIL_FIELDS) {
    if (body[field] === undefined) continue;
    target[field] = body[field] === null ? undefined : body[field];
  }
}

/**
 * `POST /events`. Butuh `event.create`. Organisasi lama: pemanggil harus anggota organisasi itu
 * (super admin lintas organisasi). `new_organization`: organisasi baru dengan pemanggil sebagai anggota.
 * Event baru selalu DRAFT.
 */
export function createEventRecord(
  user: MockUser,
  body: Record<string, unknown> | undefined,
): ApiEvent {
  const access = mockAccess(user);
  forbidUnless(access.permissions.includes(PERMISSION.EVENT_CREATE));
  validateDetails(body, null);

  const newOrganization = body?.new_organization as
    { name?: string } | undefined;
  let organizationUuid = body?.organization_id
    ? String(body.organization_id)
    : "";
  if (organizationUuid) {
    const isSuperAdmin = access.roles.some((r) => r.code === "SUPER_ADMIN");
    const org = findOrThrow(
      store.organizations,
      organizationUuid,
      "Organization",
    );
    forbidUnless(
      isSuperAdmin || org.pics.some((pic) => pic.user_uuid === user.uuid),
    );
  } else if (newOrganization?.name) {
    organizationUuid = nextUuid();
    store.organizations.push({
      uuid: organizationUuid,
      name: newOrganization.name,
      pics: [{ uuid: nextUuid(), name: user.first_name, user_uuid: user.uuid }],
    });
  } else {
    invalid({
      organization_id: ["The organization id field is required."],
    });
  }

  const event: MockEvent = {
    uuid: nextUuid(),
    organization_uuid: organizationUuid,
    name: "",
    start_at: "",
    end_at: "",
    status: "DRAFT",
  };
  applyDetails(event, body ?? {});
  store.events.push(event);
  return eventRecord(event);
}

/** `PATCH /events/{uuid}`. Butuh `event.update` dan hak mengelola event itu. */
export function updateEventRecord(
  user: MockUser,
  uuid: string,
  body: Record<string, unknown> | undefined,
): ApiEvent {
  const event = findOrThrow(store.events, uuid, "Event");
  const caller = callerFor(user, uuid);
  forbidUnless(
    caller.managesEvent && hasPermission(caller, PERMISSION.EVENT_UPDATE),
  );
  validateDetails(body, event);
  applyDetails(event, body ?? {});
  return eventRecord(event);
}

/**
 * `POST /events/{uuid}/publish`. Hanya Draft. Seperti backend asli, kompetisi Draft
 * di event itu ikut menjadi SCHEDULED.
 */
export function publishEventRecord(user: MockUser, uuid: string): ApiEvent {
  const event = findOrThrow(store.events, uuid, "Event");
  const caller = callerFor(user, uuid);
  guard(
    caller.managesEvent && hasPermission(caller, PERMISSION.EVENT_PUBLISH),
    event.status === "DRAFT",
    "Only a draft event can be published.",
  );
  for (const competition of store.competitions)
    if (competition.event_uuid === uuid && competition.status === "DRAFT")
      competition.status = "SCHEDULED";
  event.status = "PUBLISHED";
  return eventRecord(event);
}

/** `DELETE /events/{uuid}`: membatalkan event (status CANCELLED), tidak menghapus datanya. */
export function cancelEventRecord(user: MockUser, uuid: string): null {
  const event = findOrThrow(store.events, uuid, "Event");
  const caller = callerFor(user, uuid);
  forbidUnless(
    caller.managesEvent && hasPermission(caller, PERMISSION.EVENT_DELETE),
  );
  event.status = "CANCELLED";
  return null;
}
