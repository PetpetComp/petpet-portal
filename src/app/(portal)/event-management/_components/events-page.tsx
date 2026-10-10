"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Can } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  SegmentedTabs,
  type SegmentedTab,
} from "@/components/ui/segmented-tabs";
import {
  EMPTY_COLUMN_FILTERS,
  INITIAL_LIST_STATE,
  PER_PAGE_OPTIONS,
  buildEventListQuery,
  hasActiveFilters,
  type EventColumnFilters,
  type EventListState,
} from "@/domains/events/list-state";
import { useEvents } from "@/domains/events/queries";
import {
  EVENT_PHASE_LABEL,
  EVENT_TAB_PHASES,
  type EventPhase,
  type EventSort,
  type EventSummary,
} from "@/domains/events/types";
import { useOrganizations } from "@/domains/organizations/queries";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { USING_MOCK_BACKEND } from "@/lib/backend-mode";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { EventsTable } from "./events-table";

/** Nilai tab "All". Tab lain memakai nama fase. */
type TabValue = EventPhase | "ALL";

/** Jumlah di samping label tab, diambil dari `summary` server (hanya ada di mode mock). */
const SUMMARY_KEY: Record<
  (typeof EVENT_TAB_PHASES)[number],
  keyof EventSummary
> = {
  EVENT_DAY: "eventDay",
  UPCOMING: "upcoming",
  DRAFT: "draft",
  FINISHED: "finished",
};

/**
 * Halaman list event (`/event-management`), sesuai desain A-Events.
 * Filter, pencarian, urutan, dan paging semuanya dikirim ke server lewat `useEvents`.
 * Di mode backend asli (yang belum mendukungnya) tab status, pencarian, dan filter kolom
 * disembunyikan; yang tersisa filter organizer dan paging (docs 08 bagian 9.3, docs 09 bagian F).
 */
export function EventsPage() {
  const { can } = useAuth();
  const [state, setState] = useState<EventListState>(INITIAL_LIST_STATE);
  const organizations = useOrganizations();
  const serverFilters = USING_MOCK_BACKEND;

  // Ketikan di-debounce supaya server tidak ditembak di tiap huruf.
  const search = useDebouncedValue(state.search);
  const name = useDebouncedValue(state.filters.name);
  const venue = useDebouncedValue(state.filters.venue);
  const events = useEvents(buildEventListQuery(state, { search, name, venue }));

  /** Ubah satu bagian status, lalu kembali ke halaman 1 (hasil berubah, nomor halaman lama tak berarti). */
  function update(patch: Partial<EventListState>) {
    setState((current) => ({ ...current, ...patch, page: 1 }));
  }

  function changeFilters(patch: Partial<EventColumnFilters>) {
    setState((current) => ({
      ...current,
      filters: { ...current.filters, ...patch },
      page: 1,
    }));
  }

  /** Klik judul kolom: urutan yang sama dibalik, kolom baru mulai dari urutan bawaannya. */
  function changeSort(sort: EventSort) {
    setState((current) => ({
      ...current,
      sort,
      direction:
        current.sort === sort
          ? current.direction === "asc"
            ? "desc"
            : "asc"
          : sort === "name"
            ? "asc"
            : "desc",
      page: 1,
    }));
  }

  const summary = events.data?.summary ?? null;
  const tabs: SegmentedTab<TabValue>[] = [
    { value: "ALL", label: "All", count: summary?.all },
    ...EVENT_TAB_PHASES.map((phase) => ({
      value: phase,
      label: EVENT_PHASE_LABEL[phase],
      count: summary?.[SUMMARY_KEY[phase]],
    })),
  ];
  const filtersActive = hasActiveFilters(state);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 className="font-display text-[34px] leading-[38px] font-bold">
            Events
          </h1>
          <p className="text-muted-foreground text-[15px]">
            Open an event to manage its competitions, registrations and
            event-day operations.
          </p>
        </div>
        <Can permission={PERMISSION.EVENT_CREATE}>
          <Link
            href={ROUTES.eventManagement.create}
            className={cn(
              buttonVariants(),
              "min-h-11 rounded-xl px-[18px] text-[15px] font-bold",
            )}
          >
            <Plus size={18} aria-hidden />
            New event
          </Link>
        </Can>
      </header>

      {serverFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            label="Status"
            tabs={tabs}
            value={state.filters.phase || "ALL"}
            onChange={(value) =>
              changeFilters({ phase: value === "ALL" ? "" : value })
            }
          />
          <label className="border-input focus-within:border-primary flex min-h-11 w-full max-w-80 items-center gap-2 rounded-xl border bg-white px-3.5 sm:w-80">
            <Search size={18} aria-hidden className="text-muted-foreground" />
            <input
              type="search"
              aria-label="Search events"
              placeholder="Search event, venue or organizer"
              value={state.search}
              onChange={(e) => update({ search: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
          </label>
        </div>
      )}

      {events.isError ? (
        <ErrorState
          error={events.error}
          fallback="Unable to load events."
          onRetry={() => events.refetch()}
        />
      ) : (
        <>
          <EventsTable
            events={events.data?.items ?? []}
            organizers={organizations.data ?? []}
            loading={events.isPending || events.isPlaceholderData}
            features={{ serverFilters }}
            filters={state.filters}
            onFilterChange={changeFilters}
            onClearFilters={() =>
              setState((current) => ({
                ...current,
                filters: EMPTY_COLUMN_FILTERS,
                search: "",
                page: 1,
              }))
            }
            filtersActive={filtersActive}
            sort={state.sort}
            direction={state.direction}
            onSortChange={changeSort}
            canCreate={can(PERMISSION.EVENT_CREATE)}
          />
          <div className="[&>nav]:border-t-0">
            <Pagination
              label="events"
              page={state.page}
              perPage={state.perPage}
              total={events.data?.meta.total ?? 0}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={(page) => setState((s) => ({ ...s, page }))}
              onPerPageChange={(perPage) =>
                setState((s) => ({ ...s, perPage, page: 1 }))
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
