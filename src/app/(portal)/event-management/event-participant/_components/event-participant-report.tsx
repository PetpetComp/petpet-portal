"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { formatDate, formatDateTime } from "@/lib/format/date";

import {
  buildParticipantRows,
  type ParticipantRow,
} from "../_lib/participant-rows";

export function EventParticipantReport() {
  const { data } = usePortalData();
  const rows = buildParticipantRows(data);
  const [eventFilter, setEventFilter] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [petFilter, setPetFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const filtered = rows.filter(
    (row) =>
      (!eventFilter || row.eventName === eventFilter) &&
      (!competitionFilter || row.competitionName === competitionFilter) &&
      (!typeFilter || row.competitionType === typeFilter) &&
      row.ownerName.toLowerCase().includes(ownerFilter.toLowerCase()) &&
      row.petName.toLowerCase().includes(petFilter.toLowerCase()) &&
      (!paymentFilter || row.paymentStatus === paymentFilter),
  );

  function clearFilters() {
    setEventFilter("");
    setCompetitionFilter("");
    setTypeFilter("");
    setOwnerFilter("");
    setPetFilter("");
    setPaymentFilter("");
  }

  const columns: Column<ParticipantRow>[] = [
    { key: "eventName", label: "Event Name", value: (row) => row.eventName },
    {
      key: "competitionName",
      label: "Competition Name",
      value: (row) => row.competitionName,
    },
    {
      key: "competitionType",
      label: "Competition Type",
      value: (row) => row.competitionType,
    },
    {
      key: "participantId",
      label: "Participant ID",
      value: (row) => row.participantId,
    },
    { key: "ownerName", label: "Owner Name", value: (row) => row.ownerName },
    {
      key: "petName",
      label: "Pet Name | Animal | Variant",
      value: (row) => row.petName,
      render: (row) => (
        <div className="record-name">
          <div>
            <strong>{row.petName}</strong>
            <small>
              {row.animal} · {row.variant || "-"}
            </small>
          </div>
        </div>
      ),
    },
    {
      key: "paymentStatus",
      label: "Payment Status",
      value: (row) => row.paymentStatus,
      render: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    {
      key: "registeredDate",
      label: "Registered Date",
      value: (row) => row.registeredDate,
      render: (row) => formatDate(row.registeredDate),
    },
    {
      key: "registeredBy",
      label: "Registered By",
      value: (row) => row.registeredBy || "-",
    },
    {
      key: "paymentDate",
      label: "Payment Date",
      value: (row) => row.paymentDate,
      render: (row) => formatDate(row.paymentDate),
    },
    {
      key: "paymentBy",
      label: "Payment By",
      value: (row) => row.paymentBy || "-",
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      value: (row) => row.paymentMethod || "-",
    },
    {
      key: "paymentAmount",
      label: "Payment Amount",
      value: (row) => row.paymentAmount,
      render: (row) => "Rp " + row.paymentAmount.toLocaleString("id-ID"),
    },
    {
      key: "paymentPeriod",
      label: "Payment Period",
      value: (row) => row.paymentPeriod || "-",
    },
    {
      key: "verifiedDate",
      label: "Verified Date",
      value: (row) => row.verifiedDate,
      render: (row) => formatDate(row.verifiedDate),
    },
    {
      key: "verifiedBy",
      label: "Verified By",
      value: (row) => row.verifiedBy || "-",
    },
    {
      key: "createdDate",
      label: "Created Date",
      value: (row) => row.createdDate,
      render: (row) => formatDateTime(row.createdDate),
    },
    {
      key: "createdBy",
      label: "Created By",
      value: (row) => row.createdBy || "-",
    },
    {
      key: "updatedDate",
      label: "Updated Date",
      value: (row) => row.updatedDate,
      render: (row) => formatDateTime(row.updatedDate),
    },
    {
      key: "updatedBy",
      label: "Updated By",
      value: (row) => row.updatedBy || "-",
    },
  ];

  return (
    <div className="page-stack">
      <PageHeading
        title="Event Participant"
        description="Review participant registrations across all events and competitions, including payment and audit information."
        actions={
          <div className="event-participant-summary">
            <strong>{rows.length}</strong>
            <span>Total participants</span>
          </div>
        }
      />
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <strong>Filters</strong>
            <p className="muted">
              Use one or more filters to narrow the participant list.
            </p>
          </div>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
        <div className="form-grid">
          <Field label="Event Name">
            <Select
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
            >
              <option value="">All events</option>
              {Array.from(new Set(rows.map((row) => row.eventName))).map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Competition Name">
            <Select
              value={competitionFilter}
              onChange={(event) => setCompetitionFilter(event.target.value)}
            >
              <option value="">All competitions</option>
              {Array.from(new Set(rows.map((row) => row.competitionName))).map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Competition Type">
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {Array.from(new Set(rows.map((row) => row.competitionType))).map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Owner Name">
            <Input
              type="search"
              placeholder="Search owner name"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            />
          </Field>
          <Field label="Pet Name">
            <Input
              type="search"
              placeholder="Search pet name"
              value={petFilter}
              onChange={(event) => setPetFilter(event.target.value)}
            />
          </Field>
          <Field label="Payment Status">
            <Select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </Select>
          </Field>
        </div>
      </section>
      <section>
        <div className="section-head">
          <strong>Participant List</strong>
          <span className="muted">
            Showing {filtered.length} of {rows.length}
          </span>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Event participants"
        />
      </section>
    </div>
  );
}
