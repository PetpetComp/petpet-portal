"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarX, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEventSchedule } from "@/domains/events/format";
import { useEvents } from "@/domains/events/queries";
import { ROUTES } from "@/lib/constants/routes";
import { EventAvatar } from "@/app/(portal)/event-management/_components/event-avatar";
import { EventPhaseBadge } from "@/app/(portal)/event-management/_components/event-phase-badge";

const PER_PAGE_OPTIONS = [8, 16, 32];

/**
 * Tab Events di detail organisasi: event milik organisasi lewat
 * `GET /events?organization_id=` dengan paging server. Desain Org-Detail hanya memuat nama tab;
 * barisnya memakai komponen event yang sudah ada (inisial, nama, jadwal, status).
 * Dipanggil dari `events/page`.
 */
export function EventsTab({ organizationId }: { organizationId: string }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
  const events = useEvents({ organizationId, page, perPage });
  const items = events.data?.items ?? [];
  const loading = events.isPending || events.isPlaceholderData;

  if (events.isError)
    return (
      <ErrorState
        error={events.error}
        fallback="Unable to load events."
        onRetry={() => events.refetch()}
      />
    );

  return (
    <section className="grid gap-4">
      <div
        className="border-border overflow-hidden rounded-2xl border bg-white"
        aria-busy={loading || undefined}
      >
        {loading && items.length === 0 ? (
          [0, 1, 2].map((n) => (
            <div
              key={n}
              className="border-muted flex items-center gap-3 border-b px-5 py-3.5"
            >
              <Skeleton className="size-10 rounded-[10px]" />
              <Skeleton className="h-4 w-56" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarX}
              message="This organization has no events yet."
            />
          </div>
        ) : (
          <ul>
            {items.map((event) => {
              const { date, time } = formatEventSchedule(
                event.startAt,
                event.endAt,
              );
              return (
                <li key={event.id}>
                  <Link
                    href={ROUTES.eventManagement.detail(event.id)}
                    className="border-muted hover:bg-muted/50 text-foreground flex flex-wrap items-center gap-3 border-b px-5 py-3.5"
                  >
                    <EventAvatar name={event.name} phase={event.phase} />
                    <span className="flex min-w-0 flex-1 basis-48 flex-col">
                      <b className="break-words">{event.name}</b>
                      <span className="text-muted-foreground text-[13px]">
                        {date} · {time}
                        {event.venueName ? ` · ${event.venueName}` : ""}
                      </span>
                    </span>
                    <EventPhaseBadge event={event} />
                    <ChevronRight
                      size={16}
                      aria-hidden
                      className="text-muted-foreground"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-1 [&>nav]:border-t-0">
          <Pagination
            label="events"
            page={page}
            perPage={perPage}
            total={events.data?.meta.total ?? 0}
            perPageOptions={PER_PAGE_OPTIONS}
            onPageChange={setPage}
            onPerPageChange={(next) => {
              setPerPage(next);
              setPage(1);
            }}
          />
        </div>
      </div>
    </section>
  );
}
