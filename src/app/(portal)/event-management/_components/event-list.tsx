"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Download, Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { exportCsv } from "@/lib/export-csv";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { eventInitials } from "../_lib/event-rules";

const BASE_PATH = "/event-management";

export function EventList({
  events,
  onRequestDelete,
}: {
  events: PortalRecord[];
  onRequestDelete: (event: PortalRecord) => void;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [organizer, setOrganizer] = useState("");
  const organizers = Array.from(new Set(events.map((event) => event.organizer))).filter(
    Boolean,
  );
  const filtered = events.filter(
    (event) =>
      event.name.toLowerCase().includes(name.toLowerCase()) &&
      (!status || event.status === status) &&
      (!organizer || event.organizer === organizer),
  );
  function clearFilters() {
    setName("");
    setStatus("");
    setOrganizer("");
  }
  const columns: Column<PortalRecord>[] = [
    {
      key: "name",
      label: "Event Name",
      value: (row) => row.name,
      render: (row) => (
        <div className="record-name">
          {row.photo ? (
            <Image
              src={row.photo}
              width={38}
              height={38}
              unoptimized
              alt=""
              className="image-preview"
            />
          ) : (
            <span className="record-initials">{eventInitials(row.name)}</span>
          )}
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    {
      key: "startDate",
      label: "Start Date",
      value: (row) => row.startDate,
      render: (row) => formatDateTime(row.startDate),
    },
    {
      key: "endDate",
      label: "End Date",
      value: (row) => row.endDate,
      render: (row) => formatDateTime(row.endDate),
    },
    { key: "address", label: "Address", value: (row) => row.address || "-" },
    { key: "location", label: "Location", value: (row) => row.location || "-" },
    { key: "organizer", label: "Organizer", value: (row) => row.organizer },
    {
      key: "status",
      label: "Status",
      value: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdDate",
      label: "Created Date",
      value: (row) => row.createdDate,
      render: (row) => formatDate(row.createdDate),
    },
    { key: "createdBy", label: "Created By", value: (row) => row.createdBy },
    {
      key: "updatedDate",
      label: "Updated Date",
      value: (row) => row.updatedDate,
      render: (row) => formatDate(row.updatedDate),
    },
    { key: "updatedBy", label: "Updated By", value: (row) => row.updatedBy },
  ];
  return (
    <div className="page-stack">
      <PageHeading
        title="Event Management"
        description="Manage event schedules, organizers, status, and event records."
        actions={
          <Link href={BASE_PATH + "/create"} className="link-button">
            <Plus size={16} />
            Add New Event
          </Link>
        }
      />
      <section>
        <div className="toolbar">
          <Field label="Event name">
            <Input
              type="search"
              placeholder="Search event name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All status</option>
              <option value="Pending">Pending</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </Select>
          </Field>
          <Field label="Organizer">
            <Select value={organizer} onChange={(event) => setOrganizer(event.target.value)}>
              <option value="">All organizers</option>
              {organizers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <div className="toolbar-actions">
            <Button variant="secondary" onClick={clearFilters}>
              <RotateCcw size={14} />
              Clear Filter
            </Button>
            <Button
              variant="secondary"
              disabled={!filtered.length}
              onClick={() => exportCsv("Event Management", filtered)}
            >
              <Download size={14} />
              Export CSV
            </Button>
          </div>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Events"
          actions={(event) => (
            <>
              <Link
                href={BASE_PATH + "/" + event.id}
                title={"View " + event.name}
                aria-label={"View " + event.name}
              >
                <Eye size={15} />
              </Link>
              <Link
                href={BASE_PATH + "/" + event.id + "/edit"}
                title={"Edit " + event.name}
                aria-label={"Edit " + event.name}
              >
                <Pencil size={14} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title={"Delete " + event.name}
                aria-label={"Delete " + event.name}
                onClick={() => onRequestDelete(event)}
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
