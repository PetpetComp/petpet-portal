"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Can } from "@/components/common/can";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import {
  useCompetitionTypes,
  useEventCompetitions,
} from "@/domains/competitions/queries";
import {
  COMPETITION_STATUS_LABEL,
  type Competition,
} from "@/domains/competitions/types";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";

/**
 * All competitions of one event are loaded at once (a handful per event),
 * so filtering here in the browser is exact, unlike paged lists.
 */
export function EventCompetitions({ eventId }: { eventId: string }) {
  const competitions = useEventCompetitions(eventId);
  const types = useCompetitionTypes();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const typeName = (c: Competition) =>
    types.data?.find((t) => t.id === c.typeId)?.name ?? "-";
  const registration = (c: Competition) =>
    c.registrationOpen ? "Open" : "Closed";
  const status = (c: Competition) => COMPETITION_STATUS_LABEL[c.status];

  const rows = (competitions.data ?? []).filter(
    (c) =>
      (!filters.name ||
        c.name.toLowerCase().includes(filters.name.toLowerCase())) &&
      (!filters.type || typeName(c) === filters.type) &&
      (!filters.status || status(c) === filters.status) &&
      (!filters.registration || registration(c) === filters.registration),
  );

  const columns: Column<Competition>[] = [
    {
      key: "name",
      label: "Competition",
      value: (c) => c.name,
      filter: { type: "text" },
      render: (c) => (
        <Link
          href={ROUTES.eventManagement.competitionDetail(eventId, c.id)}
          className="font-semibold"
        >
          {c.name}
        </Link>
      ),
    },
    {
      key: "type",
      label: "Type",
      value: typeName,
      filter: {
        type: "select",
        options: (types.data ?? []).map((t) => t.name),
      },
    },
    {
      key: "startAt",
      label: "Schedule",
      value: (c) => c.startAt,
      render: (c) => formatDateTime(c.startAt),
    },
    { key: "arena", label: "Arena", value: (c) => c.arenaName || "-" },
    {
      key: "capacity",
      label: "Slots",
      value: (c) => c.capacity ?? 0,
      render: (c) => c.capacity ?? "-",
    },
    {
      key: "status",
      label: "Status",
      value: status,
      filter: {
        type: "select",
        options: Object.values(COMPETITION_STATUS_LABEL),
      },
      render: (c) => <StatusBadge status={status(c)} />,
    },
    {
      key: "registration",
      label: "Registration",
      value: registration,
      filter: { type: "select", options: ["Open", "Closed"] },
      render: (c) => <StatusBadge status={registration(c)} />,
    },
  ];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {competitions.isSuccess
            ? `${competitions.data.length} competitions in this event`
            : "Loading competitions…"}
        </p>
        <Can permission={PERMISSION.COMPETITION_CREATE}>
          <Link
            href={ROUTES.eventManagement.createCompetition(eventId)}
            className="link-button"
          >
            <Plus size={16} />
            Add competition
          </Link>
        </Can>
      </div>
      {competitions.isError ? (
        <p role="alert" className="form-error">
          {competitions.error instanceof Error
            ? competitions.error.message
            : "Unable to load competitions."}
        </p>
      ) : (
        <DataTable
          label="Competitions"
          rows={rows}
          columns={columns}
          filters={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
        />
      )}
    </section>
  );
}
