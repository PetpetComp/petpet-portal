"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarX, ChevronRight, X } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldClass } from "@/components/ui/form-field";
import { formatEventSchedule } from "@/domains/events/format";
import type { EventColumnFilters } from "@/domains/events/list-state";
import {
  EVENT_PHASES,
  EVENT_PHASE_LABEL,
  type Event,
  type EventPhase,
  type EventSort,
  type SortDirection,
} from "@/domains/events/types";
import type { Organization } from "@/domains/organizations/types";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { EventAvatar } from "./event-avatar";
import { EventPhaseBadge } from "./event-phase-badge";

/** Lebar kolom: Event, Date, Venue, Organizer, Status, panah. Sama dengan desain A-Events. */
const GRID =
  "grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_120px_32px] items-center gap-4 px-5";

/** Kontrol filter lebih kecil dari field form biasa (36px, sesuai desain). */
const filterClass = `${fieldClass} !min-h-9 !rounded-[10px] !px-2.5 !text-[13px]`;

/** Fitur tabel yang aktif. Di mode backend asli hanya filter organizer yang didukung server. */
export type EventsTableFeatures = {
  /** Filter nama, bulan, venue, status, dan urutan didukung server. */
  serverFilters: boolean;
};

type Props = {
  events: Event[];
  /** id organisasi -> nama, untuk event yang belum membawa `organizationName`. */
  organizers: Organization[];
  loading: boolean;
  features: EventsTableFeatures;
  filters: EventColumnFilters;
  onFilterChange: (patch: Partial<EventColumnFilters>) => void;
  onClearFilters: () => void;
  filtersActive: boolean;
  sort: EventSort;
  direction: SortDirection;
  onSortChange: (sort: EventSort) => void;
  /** True bila akun boleh membuat event: keadaan kosong menampilkan tautan "Create the first event". */
  canCreate: boolean;
};

/** Nama organizer: dari event bila ada, kalau tidak dicari di daftar organisasi. */
function organizerName(event: Event, organizers: Organization[]): string {
  return (
    event.organizationName ||
    organizers.find((o) => o.id === event.organizationId)?.name ||
    "-"
  );
}

/**
 * Tabel list event sesuai desain A-Events: header, baris filter per kolom,
 * lalu baris event. Semua filter dikirim ke server lewat `onFilterChange`
 * (pemanggil yang memegang state dan query). Tabel dapat digulir ke samping di dalam kartu.
 * Dipanggil dari `EventsPage`.
 */
export function EventsTable(props: Props) {
  const { events, organizers, loading } = props;
  const empty = !loading && events.length === 0;
  return (
    <div
      className="border-border overflow-x-auto rounded-2xl border bg-white"
      aria-busy={loading || undefined}
    >
      <div role="table" aria-label="Events" className="min-w-[880px]">
        <HeaderRow {...props} />
        <FilterRow {...props} />
        {loading &&
          events.length === 0 &&
          [0, 1, 2, 3, 4].map((n) => <SkeletonRow key={n} />)}
        {events.map((event) => (
          <div
            role="row"
            key={event.id}
            className={cn(
              GRID,
              "border-muted border-b py-3.5 last:border-b-0",
              event.phase === "EVENT_DAY" && "bg-primary-soft/25",
            )}
          >
            <div role="cell" className="flex min-w-0 items-center gap-3">
              <EventAvatar name={event.name} phase={event.phase} />
              <div className="flex min-w-0 flex-col">
                <Link
                  href={ROUTES.eventManagement.detail(event.id)}
                  className="text-foreground text-[15px] font-bold hover:underline"
                >
                  {event.name}
                </Link>
                {event.code && (
                  <span className="text-muted-foreground font-mono text-xs">
                    {event.code}
                  </span>
                )}
              </div>
            </div>
            <div role="cell">
              <Schedule event={event} />
            </div>
            <div role="cell">{event.venueName || "-"}</div>
            <div role="cell">{organizerName(event, organizers)}</div>
            <div role="cell">
              <EventPhaseBadge event={event} />
            </div>
            <div role="cell">
              <Link
                href={ROUTES.eventManagement.detail(event.id)}
                aria-label={`Open ${event.name}`}
                className="text-muted-foreground hover:text-primary-dark inline-flex"
              >
                <ChevronRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        ))}
        {empty && (
          <div className="p-6">
            {props.filtersActive ? (
              <div className="grid justify-items-center gap-3">
                <EmptyState
                  icon={CalendarX}
                  message="No events match these filters."
                />
                <Button variant="secondary" onClick={props.onClearFilters}>
                  Show all events
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={CalendarX}
                message="No events yet."
                action={
                  props.canCreate
                    ? {
                        label: "Create the first event",
                        href: ROUTES.eventManagement.create,
                      }
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Dua baris tanggal: tanggal di atas, jam di bawah (abu). */
function Schedule({ event }: { event: Event }) {
  const { date, time } = formatEventSchedule(event.startAt, event.endAt);
  return (
    <>
      {date}
      <br />
      <span className="text-muted-foreground">{time}</span>
    </>
  );
}

function SkeletonRow() {
  return (
    <div role="row" className={cn(GRID, "border-muted border-b py-3.5")}>
      <div role="cell" className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-[10px]" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div role="cell">
        <Skeleton className="h-4 w-24" />
      </div>
      <div role="cell">
        <Skeleton className="h-4 w-32" />
      </div>
      <div role="cell">
        <Skeleton className="h-4 w-28" />
      </div>
      <div role="cell">
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div role="cell" />
    </div>
  );
}

function SortableHeader({
  label,
  column,
  props,
}: {
  label: string;
  column: EventSort;
  props: Props;
}) {
  if (!props.features.serverFilters) return <>{label}</>;
  const active = props.sort === column;
  const Arrow = props.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => props.onSortChange(column)}
      className="hover:text-primary-dark inline-flex items-center gap-1.5 font-bold tracking-[0.06em] uppercase"
    >
      {label}
      {active && <Arrow size={13} aria-hidden />}
    </button>
  );
}

function HeaderRow(props: Props) {
  return (
    <div
      role="row"
      className={cn(
        GRID,
        "border-border text-muted-foreground border-b py-3.5 text-xs font-bold tracking-[0.06em]",
      )}
    >
      <div role="columnheader" aria-sort={ariaSort(props, "name")}>
        <SortableHeader label="EVENT" column="name" props={props} />
      </div>
      <div role="columnheader" aria-sort={ariaSort(props, "start_at")}>
        <SortableHeader label="DATE" column="start_at" props={props} />
      </div>
      <div role="columnheader">VENUE</div>
      <div role="columnheader">ORGANIZER</div>
      <div role="columnheader">STATUS</div>
      <div role="columnheader">
        <span className="sr-only">Open</span>
      </div>
    </div>
  );
}

function ariaSort(props: Props, column: EventSort) {
  if (!props.features.serverFilters || props.sort !== column) return undefined;
  return props.direction === "asc" ? "ascending" : "descending";
}

/** Baris filter per kolom. Kontrol yang belum didukung server tidak ditampilkan (docs 08 bagian 9.3). */
function FilterRow(props: Props) {
  const { filters, features, organizers } = props;
  return (
    <div
      role="row"
      className={cn(GRID, "border-border bg-primary-soft/40 border-b py-2.5")}
    >
      <div role="cell">
        {features.serverFilters && (
          <input
            type="text"
            aria-label="Filter event name or ID"
            placeholder="Name or ID"
            value={filters.name}
            onChange={(e) => props.onFilterChange({ name: e.target.value })}
            className={filterClass}
          />
        )}
      </div>
      <div role="cell">
        {features.serverFilters && (
          <input
            type="month"
            aria-label="Filter month"
            value={filters.month}
            onChange={(e) => props.onFilterChange({ month: e.target.value })}
            className={filterClass}
          />
        )}
      </div>
      <div role="cell">
        {features.serverFilters && (
          <input
            type="text"
            aria-label="Filter venue or city"
            placeholder="Venue or city"
            value={filters.venue}
            onChange={(e) => props.onFilterChange({ venue: e.target.value })}
            className={filterClass}
          />
        )}
      </div>
      <div role="cell">
        <select
          aria-label="Filter organizer"
          value={filters.organizationId}
          onChange={(e) =>
            props.onFilterChange({ organizationId: e.target.value })
          }
          className={filterClass}
        >
          <option value="">All organizers</option>
          {organizers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div role="cell">
        {features.serverFilters && (
          <select
            aria-label="Filter status"
            value={filters.phase}
            onChange={(e) =>
              props.onFilterChange({ phase: e.target.value as EventPhase | "" })
            }
            className={filterClass}
          >
            <option value="">All</option>
            {EVENT_PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {EVENT_PHASE_LABEL[phase]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div role="cell">
        <button
          type="button"
          aria-label="Clear filters"
          title="Clear filters"
          disabled={!props.filtersActive}
          onClick={props.onClearFilters}
          className="text-muted-foreground hover:text-primary-dark grid size-8 place-items-center rounded-[10px] disabled:opacity-40"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
