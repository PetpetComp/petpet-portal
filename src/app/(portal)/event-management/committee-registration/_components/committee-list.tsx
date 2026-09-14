"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import type { PortalRecord } from "@/types/portal";
import { RolePill } from "@/app/(portal)/event-management/_components/role-pill";
import { COMMITTEE_ROLES } from "../_lib/committee-rules";

const BASE_PATH = "/event-management/committee-registration";

interface CommitteeRow {
  id: string;
  userId: string;
  role: string;
  eventId: string;
  competitionId?: string;
  user?: PortalRecord;
  eventName: string;
  competitionName?: string;
}

export function CommitteeList({
  committee,
  users,
  events,
  competitions,
  onRequestDelete,
}: {
  committee: PortalRecord[];
  users: PortalRecord[];
  events: PortalRecord[];
  competitions: PortalRecord[];
  onRequestDelete: (row: PortalRecord) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");

  const rows: CommitteeRow[] = committee.map((item) => ({
    id: item.id,
    userId: item.userId,
    role: item.role,
    eventId: item.eventId,
    competitionId: item.competitionId,
    user: users.find((user) => user.id === item.userId),
    eventName: events.find((event) => event.id === item.eventId)?.name ?? "-",
    competitionName: competitions.find((row) => row.id === item.competitionId)?.name,
  }));

  const filtered = rows.filter(
    (row) =>
      (!eventId || row.eventId === eventId) &&
      (!role || row.role === role) &&
      (!search ||
        (row.user?.name + " " + row.userId + " " + row.role)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );

  function clearFilters() {
    setEventId("");
    setRole("");
    setSearch("");
  }

  const columns: Column<CommitteeRow>[] = [
    { key: "userId", label: "User ID", value: (row) => row.userId },
    { key: "firstName", label: "First Name", value: (row) => row.user?.firstName ?? "-" },
    { key: "lastName", label: "Last Name", value: (row) => row.user?.lastName ?? "-" },
    { key: "phone", label: "Phone", value: (row) => row.user?.phone ?? "-" },
    {
      key: "role",
      label: "Role",
      value: (row) => row.role,
      render: (row) => <RolePill role={row.role} />,
    },
    { key: "eventName", label: "Event", value: (row) => row.eventName },
    { key: "competitionName", label: "Competition", value: (row) => row.competitionName ?? "All" },
  ];

  return (
    <div className="page-stack">
      <PageHeading
        title="Committee Registration"
        description="Manage competition committee assignments from one centralized event workflow."
        actions={
          <Link href={BASE_PATH + "/create"} className="link-button">
            <Plus size={16} />
            Add Committee
          </Link>
        }
      />
      <section>
        <div className="toolbar">
          <Field label="Search">
            <Input
              type="search"
              placeholder="Search name, User ID, or role"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field label="Event">
            <Select value={eventId} onChange={(event) => setEventId(event.target.value)}>
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              {COMMITTEE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <div className="toolbar-actions">
            <Button variant="secondary" onClick={clearFilters}>
              <RotateCcw size={14} />
              Clear Filter
            </Button>
          </div>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Committee assignments"
          actions={(row) => (
            <>
              <Link href={BASE_PATH + "/" + row.id} title="View assignment">
                <Eye size={15} />
              </Link>
              <Link href={BASE_PATH + "/" + row.id + "/edit"} title="Edit assignment">
                <Pencil size={14} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title="Remove assignment"
                aria-label={"Remove " + (row.user?.name ?? row.userId)}
                onClick={() => onRequestDelete(committee.find((item) => item.id === row.id)!)}
              >
                <Trash2 size={15} />
              </Button>
            </>
          )}
        />
      </section>
    </div>
  );
}
