import type { ApiPageMeta } from "@/types/api";
import type { Meta } from "@/types/common";

/** Backend values of `events.status` (petpet-service `EventConstant`). */
export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/**
 * Fase event yang tampil di list dan header. Diturunkan BACKEND dari `status` + tanggal
 * (kontrak 13 bagian 1), layar tidak menghitungnya sendiri.
 * EVENT_DAY = terbit dan hari ini ada di antara tanggal mulai dan selesai.
 */
export const EVENT_PHASES = [
  "EVENT_DAY",
  "UPCOMING",
  "DRAFT",
  "FINISHED",
  "CANCELLED",
] as const;
export type EventPhase = (typeof EVENT_PHASES)[number];

export const EVENT_PHASE_LABEL: Record<EventPhase, string> = {
  EVENT_DAY: "Event day",
  UPCOMING: "Upcoming",
  DRAFT: "Draft",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
};

/** Urutan tab status di list event. "All" ditambahkan oleh layar. Event Cancelled hanya muncul di All. */
export const EVENT_TAB_PHASES = [
  "EVENT_DAY",
  "UPCOMING",
  "DRAFT",
  "FINISHED",
] as const satisfies readonly EventPhase[];

/** Kolom yang boleh dipakai untuk `sort` di `GET /events` (kontrak 13 bagian 1). */
export const EVENT_SORTS = ["start_at", "name"] as const;
export type EventSort = (typeof EVENT_SORTS)[number];
export type SortDirection = "asc" | "desc";

/**
 * One event exactly as the API sends it (petpet-service `EventData::toArray`).
 * Tiga field terakhir BELUM dikirim backend asli (kontrak 13 bagian 1, docs 09 bagian F),
 * jadi bertanda opsional. Mock sudah mengirimnya.
 */
export type ApiEvent = {
  uuid: string;
  organization_uuid: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  map_location: string | null;
  timezone: string;
  start_at: string;
  end_at: string;
  status: EventStatus;
  /** Kode tampil, contoh "EVT-2026-0002". */
  code?: string;
  organization_name?: string;
  phase?: EventPhase;
};

/** `summary` dari `GET /events`: jumlah event per tab, atas filter lain kecuali `phase`. */
export type ApiEventSummary = {
  all: number;
  event_day: number;
  upcoming: number;
  draft: number;
  finished: number;
};

/** `data` dari `GET /events`. `summary` hanya ada di mock. */
export type ApiEventList = {
  items: ApiEvent[];
  meta: ApiPageMeta;
  summary?: ApiEventSummary;
};

/** An event as the screens use it. Built from `ApiEvent` by `fromApi` only. */
export type Event = {
  id: string;
  /** Kosong bila backend belum mengirim kode. */
  code: string;
  organizationId: string;
  /** Kosong bila backend belum mengirim nama organisasi. */
  organizationName: string;
  name: string;
  tagline: string;
  description: string;
  venueName: string;
  venueAddress: string;
  mapLocation: string;
  timezone: string;
  startAt: string;
  endAt: string;
  status: EventStatus;
  /** Null bila backend belum mengirim fase: layar lalu memakai `status`. */
  phase: EventPhase | null;
};

export type EventSummary = {
  all: number;
  eventDay: number;
  upcoming: number;
  draft: number;
  finished: number;
};

/** Satu halaman list event. `summary` null di mode backend asli. */
export type EventPage = {
  items: Event[];
  meta: Meta;
  summary: EventSummary | null;
};

/** Filter, sort, dan paging list event yang dikirim ke server. `page` mulai dari 1. */
export type EventListQuery = {
  phase?: EventPhase;
  /** Pencarian bebas: nama, kode, venue, organizer. */
  q?: string;
  /** Filter kolom Event: nama atau kode. */
  name?: string;
  /** Filter kolom Venue. */
  venue?: string;
  /** Bulan "YYYY-MM": event yang jadwalnya menyentuh bulan itu. */
  month?: string;
  organizationId?: string;
  sort?: EventSort;
  direction?: SortDirection;
  page: number;
  perPage: number;
};

/**
 * Mengubah `EventListQuery` jadi query string API. Nilai kosong dibuang.
 * Dipanggil dari `listEvents`; dites di types.test.ts.
 */
export function eventListParams(query: EventListQuery) {
  return {
    phase: query.phase,
    q: query.q?.trim(),
    name: query.name?.trim(),
    venue: query.venue?.trim(),
    month: query.month,
    organization_id: query.organizationId,
    sort: query.sort,
    direction: query.direction,
    page: query.page,
    per_page: query.perPage,
  };
}

/** Mengubah satu baris API jadi bentuk layar. */
export function fromApi(row: ApiEvent): Event {
  return {
    id: row.uuid,
    code: row.code ?? "",
    organizationId: row.organization_uuid,
    organizationName: row.organization_name ?? "",
    name: row.name,
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    venueName: row.venue_name ?? "",
    venueAddress: row.venue_address ?? "",
    mapLocation: row.map_location ?? "",
    timezone: row.timezone,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    phase: row.phase ?? null,
  };
}

/** Mengubah `data` dari `GET /events` jadi `EventPage`. */
export function eventPageFromApi(data: ApiEventList): EventPage {
  return {
    items: data.items.map(fromApi),
    meta: {
      currentPage: data.meta.current_page,
      perPage: data.meta.per_page,
      total: data.meta.total,
      lastPage: data.meta.last_page,
    },
    summary: data.summary
      ? {
          all: data.summary.all,
          eventDay: data.summary.event_day,
          upcoming: data.summary.upcoming,
          draft: data.summary.draft,
          finished: data.summary.finished,
        }
      : null,
  };
}

export const isPublished = (event: Event) => event.status === "PUBLISHED";

/**
 * Label badge: fase dari backend, atau status bila backend belum mengirim fase
 * (mode backend asli). Dipakai list, header, dan pratinjau wizard.
 */
export function eventPhaseLabel(
  event: Pick<Event, "phase" | "status">,
): string {
  if (event.phase) return EVENT_PHASE_LABEL[event.phase];
  return event.status.charAt(0) + event.status.slice(1).toLowerCase();
}
