"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type Column } from "@/components/common/data-table";
import { PageHeading } from "@/components/common/page-heading";
import { StatusBadge } from "@/components/common/status-badge";
import {
  useDeleteEvent,
  useEvents,
  useOrganizerNames,
} from "@/domains/events/queries";
import { EVENT_STATUSES, type Event } from "@/domains/events/types";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";
import { eventInitials } from "../_lib/event-rules";

export function EventsPage() {
  const [page, setPage] = useState(0); // 0-based, as DataTable's `server` expects
  const [pageSize, setPageSize] = useState(10);
  const [toDelete, setToDelete] = useState<Event | null>(null);
  const events = useEvents(page + 1, pageSize);
  const organizers = useOrganizerNames();
  const remove = useDeleteEvent();
  const organizerOf = (e: Event) => organizers.data?.[e.organizationId] ?? "-";

  // Filters are shown but inactive: the events API only filters by
  // organization_id. Tracked in docs/09 §A.
  const columns: Column<Event>[] = [
    {
      key: "name",
      label: "Event",
      filter: { type: "text" },
      render: (row) => (
        <div className="record-name">
          <span className="record-initials">{eventInitials(row.name)}</span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.tagline || row.id}</small>
          </div>
        </div>
      ),
    },
    {
      key: "startAt",
      label: "Start",
      render: (row) => formatDateTime(row.startAt),
    },
    { key: "endAt", label: "End", render: (row) => formatDateTime(row.endAt) },
    {
      key: "venue",
      label: "Venue",
      filter: { type: "text" },
      render: (row) => row.venueName || "-",
    },
    {
      key: "organizer",
      label: "Organizer",
      filter: {
        type: "select",
        options: Object.values(organizers.data ?? {}),
      },
      render: organizerOf,
    },
    {
      key: "status",
      label: "Status",
      filter: { type: "select", options: [...EVENT_STATUSES] },
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="page-stack">
      <PageHeading
        title="Events"
        description="Schedules, organizers, and status of every event."
        actions={
          <Can permission={PERMISSION.EVENT_CREATE}>
            <Link href={ROUTES.eventManagement.create} className="link-button">
              <Plus size={16} />
              New event
            </Link>
          </Can>
        }
      />
      {events.isError ? (
        <div role="alert" className="form-error">
          {events.error instanceof Error
            ? events.error.message
            : "Unable to load events."}{" "}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => events.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <DataTable
          label="Events"
          rows={events.data?.items ?? []}
          columns={columns}
          server={{
            page,
            pageSize,
            total: events.data?.total ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(0);
            },
            loading: events.isFetching,
          }}
          actions={(event) => (
            <>
              <Link
                href={ROUTES.eventManagement.detail(event.id)}
                title={"View " + event.name}
                aria-label={"View " + event.name}
              >
                <Eye size={15} />
              </Link>
              <Can permission={PERMISSION.EVENT_UPDATE}>
                <Link
                  href={ROUTES.eventManagement.edit(event.id)}
                  title={"Edit " + event.name}
                  aria-label={"Edit " + event.name}
                >
                  <Pencil size={14} />
                </Link>
              </Can>
              <Can permission={PERMISSION.EVENT_DELETE}>
                <Button
                  variant="ghost"
                  size="icon"
                  title={"Delete " + event.name}
                  aria-label={"Delete " + event.name}
                  onClick={() => setToDelete(event)}
                >
                  <Trash2 size={15} />
                </Button>
              </Can>
            </>
          )}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete event"
        description={`Delete "${toDelete?.name}"? This cannot be undone.`}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success("Event deleted"),
            onError: (cause) =>
              toast.error(
                cause instanceof Error ? cause.message : "Unable to delete.",
              ),
          })
        }
      />
    </div>
  );
}
