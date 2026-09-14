"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { CategoryPill } from "@/components/common/category-pill";
import type { PortalRecord } from "@/types/portal";
import {
  SPONSOR_CATEGORIES,
  canModifyAssignment,
  isDuplicateAssignment,
} from "../_lib/brand-rules";

export function BrandEventAssignment({
  brandId,
  events,
  assignments,
  onAdd,
  onRemove,
}: {
  brandId: string;
  events: PortalRecord[];
  assignments: PortalRecord[];
  onAdd: (assignment: PortalRecord) => void;
  onRemove: (id: string) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const eventStatus = (id: string) =>
    events.find((event) => event.id === id)?.status;

  function addAssignment() {
    if (!eventId || !category) {
      setError("Select an event and category to add an assignment.");
      return;
    }
    if (!canModifyAssignment(eventStatus(eventId))) {
      setError("Closed events cannot be added as new assignments.");
      return;
    }
    if (isDuplicateAssignment(assignments, brandId, eventId)) {
      setError("This brand is already assigned to the selected event.");
      return;
    }
    onAdd({
      id: "ASN-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: "Assignment " + eventId,
      sponsorId: brandId,
      eventId,
      category,
    });
    setEventId("");
    setCategory("");
    setError("");
  }

  const columns: Column<PortalRecord>[] = [
    {
      key: "eventId",
      label: "Event",
      value: (row) => events.find((event) => event.id === row.eventId)?.name ?? row.eventId,
    },
    {
      key: "category",
      label: "Category",
      value: (row) => row.category,
      render: (row) => <CategoryPill category={row.category} />,
    },
    {
      key: "eventStatus",
      label: "Event Status",
      value: (row) => eventStatus(row.eventId) ?? "-",
      render: (row) => <StatusBadge status={eventStatus(row.eventId) ?? "-"} />,
    },
    {
      key: "sponsorshipStatus",
      label: "Sponsorship Status",
      value: () => "Confirmed",
      render: () => <StatusBadge status="Confirmed" />,
    },
  ];

  return (
    <div>
      <div className="assignment-builder">
        <Field label="Event">
          <Select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            <option value="">Select event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Select category</option>
            {SPONSOR_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="button" variant="secondary" onClick={addAssignment}>
          <Plus size={15} />
          Add Assignment
        </Button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="assignment-table-wrap">
        <DataTable
          rows={assignments}
          columns={columns}
          label="Event partnership assignments"
          actions={(row) =>
            canModifyAssignment(eventStatus(row.eventId)) ? (
              <Button
                variant="ghost"
                size="icon"
                title="Remove assignment"
                aria-label="Remove assignment"
                onClick={() => onRemove(row.id)}
              >
                <Trash2 size={15} />
              </Button>
            ) : null
          }
        />
      </div>
      <p className="assignment-note">
        Event status follows Event Management. Add, edit, and delete are only
        allowed when Event Status is Pending.
      </p>
    </div>
  );
}
