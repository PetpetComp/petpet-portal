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

  const competitions = data.competitions.filter((item) => !eventId || item.eventId === eventId);
  const registrations = data.registrations.filter((item) => !eventId || item.eventId === eventId);
  const verifiedRegistrations = registrations.filter((item) => item.paymentStatus === "Verified");
  const revenue = registrations
    .filter((item) => item.paymentStatus !== "Pending")
    .reduce((sum, item) => {
      const fee = Number(item.registrationFee);
      if (fee) return sum + fee;
      const competition = data.competitions.find((comp) => comp.id === item.competitionId);
      return sum + Number(competition?.onlinePrice ?? 0);
    }, 0);
  const doorprizeWinners = registrations.filter((item) => item.doorprizeStatus === "Claimed").length;

  const rows: PortalRecord[] = competitions.map((item) => ({
    ...item,
    participants: String(data.registrations.filter((row) => row.competitionId === item.id).length),
    status: item.resultStatus ?? "Pending",
  }));

  return (
    <div className="page-stack">
      <PageHeading title="Report" description="Cross-event performance summary and export." />
      <section className="form-section pet-detail-card">
        <div className="eyebrow">PLATFORM OVERVIEW</div>
        <div className="stats-grid">
          <div className="stat">
            <span>Events</span>
            <strong>{data.events.length}</strong>
          </div>
          <div className="stat">
            <span>Users</span>
            <strong>{data.users.length}</strong>
          </div>
          <div className="stat">
            <span>Pets</span>
            <strong>{data.pets.length}</strong>
          </div>
          <div className="stat">
            <span>Brands</span>
            <strong>{data.brands.length}</strong>
          </div>
        </div>
      </section>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">EVENT PERFORMANCE</div>
            <h2>Competitions</h2>
          </div>
          <div className="row-actions">
            <Field label="Event">
              <Select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">All Events</option>
                {data.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" disabled={!rows.length} onClick={() => exportCsv("competition-report", rows)}>
              <Download size={15} />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat">
            <span>Competitions</span>
            <strong>{competitions.length}</strong>
          </div>
          <div className="stat">
            <span>Registrations</span>
            <strong>{registrations.length}</strong>
          </div>
          <div className="stat">
            <span>Verified Payments</span>
            <strong>{verifiedRegistrations.length}</strong>
          </div>
          <div className="stat">
            <span>Registration Revenue</span>
            <strong className="revenue-value">Rp {revenue.toLocaleString("id-ID")}</strong>
          </div>
          <div className="stat">
            <span>Doorprize Winners Claimed</span>
            <strong>{doorprizeWinners}</strong>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Competition", value: (row) => row.name },
            { key: "type", label: "Type", value: (row) => row.type },
            { key: "participants", label: "Participants", value: (row) => row.participants },
            {
              key: "status",
              label: "Results",
              value: (row) => row.status,
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
        />
      </section>
    </div>
  );
}
