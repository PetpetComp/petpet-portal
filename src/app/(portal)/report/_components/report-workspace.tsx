"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { exportCsv } from "@/lib/export-csv";
import type { PortalRecord } from "@/types/portal";
export function ReportWorkspace() {
  const { data } = usePortalData();
  const [eventId, setEventId] = useState("");
  const rows: PortalRecord[] = data.competitions
    .filter((item) => !eventId || item.eventId === eventId)
    .map((item) => ({
      ...item,
      participants: String(
        data.registrations.filter((row) => row.competitionId === item.id)
          .length,
      ),
      status: item.resultStatus ?? "Pending",
    }));
  const registrations = data.registrations.filter(
    (item) => !eventId || item.eventId === eventId,
  );
  const revenue = registrations
    .filter((item) => item.paymentStatus !== "Pending")
    .reduce(
      (sum, item) =>
        sum +
        Number(
          data.competitions.find((comp) => comp.id === item.competitionId)
            ?.onlinePrice ?? 0,
        ),
      0,
    );
  return (
    <div className="page-stack">
      <PageHeading
        title="Report"
        actions={
          <Button
            variant="secondary"
            disabled={!rows.length}
            onClick={() => exportCsv("competition-report", rows)}
          >
            <Download size={15} />
            Export CSV
          </Button>
        }
      />
      <div className="toolbar">
        <Field label="Event">
          <Select
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
          >
            <option value="">All Events</option>
            {data.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <span>Competitions</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="stat">
          <span>Registrations</span>
          <strong>{registrations.length}</strong>
        </div>
        <div className="stat">
          <span>Verified Payments</span>
          <strong>
            {
              registrations.filter((item) => item.paymentStatus === "Verified")
                .length
            }
          </strong>
        </div>
        <div className="stat">
          <span>Online Registration Value</span>
          <strong className="revenue-value">
            Rp {revenue.toLocaleString("id-ID")}
          </strong>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "Competition", value: (row) => row.name },
          { key: "type", label: "Type", value: (row) => row.type },
          {
            key: "participants",
            label: "Participants",
            value: (row) => row.participants,
          },
          {
            key: "status",
            label: "Results",
            value: (row) => row.status,
            render: (row) => <StatusBadge status={row.status} />,
          },
        ]}
      />
    </div>
  );
}
