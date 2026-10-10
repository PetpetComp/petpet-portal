"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import {
  useCompetitionAction,
  useCompetitionTypes,
  useEventCompetitions,
} from "@/domains/competitions/queries";
import {
  COMPETITION_ACTION_LABEL,
  COMPETITION_ACTIONS,
  COMPETITION_STATUS_LABEL,
  REGISTRATION_CLOSED_REASON_LABEL,
  type Competition,
  type CompetitionAction,
} from "@/domains/competitions/types";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";

/** Actions that end something for good ask first. */
const CONFIRM: Partial<
  Record<
    CompetitionAction,
    { title: string; confirm: string; text: (name: string) => string }
  >
> = {
  complete: {
    title: "Complete competition",
    confirm: "Complete",
    text: (name) =>
      `Mark "${name}" as completed? Check-in and registration stop for it.`,
  },
  cancel: {
    title: "Cancel competition",
    confirm: "Cancel competition",
    text: (name) =>
      `Cancel "${name}"? Its participants can no longer compete. This cannot be undone.`,
  },
};

const DONE: Record<CompetitionAction, string> = {
  publish: "Competition published",
  start: "Competition started",
  complete: "Competition completed",
  closeRegistration: "Registration closed",
  cancel: "Competition cancelled",
};

/**
 * All competitions of one event are loaded at once (a handful per event),
 * so filtering here in the browser is exact, unlike paged lists.
 */
export function EventCompetitions({ eventId }: { eventId: string }) {
  const competitions = useEventCompetitions(eventId);
  const types = useCompetitionTypes();
  const lifecycle = useCompetitionAction(eventId);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [toConfirm, setToConfirm] = useState<{
    competition: Competition;
    action: CompetitionAction;
  } | null>(null);

  function run(competition: Competition, action: CompetitionAction) {
    lifecycle.mutate(
      { id: competition.id, action },
      {
        onSuccess: () => toast.success(DONE[action]),
        onError: (cause) =>
          toast.error(
            cause instanceof Error ? cause.message : "Unable to save.",
          ),
      },
    );
  }
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
      render: (c) => (
        <span className="flex flex-col">
          {formatDateTime(c.startAt)}
          {c.arenaName && (
            <small className="text-muted-foreground">{c.arenaName}</small>
          )}
        </span>
      ),
    },
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
      render: (c) => (
        <StatusBadge
          status={registration(c)}
          label={
            c.registrationClosedReason
              ? REGISTRATION_CLOSED_REASON_LABEL[c.registrationClosedReason]
              : undefined
          }
        />
      ),
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
          actions={(c) => {
            const available = COMPETITION_ACTIONS.filter((a) => c.actions[a]);
            if (available.length === 0) return null;
            return (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={lifecycle.isPending}
                    aria-label={`Manage ${c.name}`}
                  >
                    Manage <ChevronDown size={14} aria-hidden />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="dropdown-content"
                    align="end"
                    sideOffset={6}
                  >
                    {available.map((a) => (
                      <DropdownMenu.Item
                        key={a}
                        className="dropdown-item"
                        onSelect={() =>
                          CONFIRM[a]
                            ? setToConfirm({ competition: c, action: a })
                            : run(c, a)
                        }
                      >
                        {COMPETITION_ACTION_LABEL[a]}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            );
          }}
        />
      )}
      <ConfirmDialog
        open={!!toConfirm}
        onOpenChange={(open) => !open && setToConfirm(null)}
        title={toConfirm ? CONFIRM[toConfirm.action]!.title : ""}
        description={
          toConfirm
            ? CONFIRM[toConfirm.action]!.text(toConfirm.competition.name)
            : ""
        }
        confirmLabel={toConfirm ? CONFIRM[toConfirm.action]!.confirm : ""}
        onConfirm={() =>
          toConfirm && run(toConfirm.competition, toConfirm.action)
        }
      />
    </section>
  );
}
