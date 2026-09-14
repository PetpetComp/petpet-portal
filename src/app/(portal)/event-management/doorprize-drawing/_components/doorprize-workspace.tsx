"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { EventInfoCard } from "@/app/(portal)/event-management/_components/event-info-card";
import { FindEvent } from "@/app/(portal)/event-management/_components/find-event";
import { EventPartners } from "@/app/(portal)/competition/_components/event-partners";
import { formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { eligibleForDraw, hasPendingWinner, pickRandom } from "../_lib/doorprize-rules";

const DOORPRIZE_STATUS_TONE: Record<string, string> = {
  Waiting: "warning",
  Claimed: "success",
  Void: "danger",
};

export function DoorprizeWorkspace() {
  const { data, save } = usePortalData();
  const [selectedEventId, setSelectedEventId] = useState("");
  const event = data.events.find((item) => item.id === selectedEventId);

  const eventRegistrations = event ? data.registrations.filter((row) => row.eventId === event.id) : [];
  const eligible = event ? eligibleForDraw(data.registrations, event.id) : [];
  const currentWinner = eventRegistrations.find((row) => row.doorprizeStatus === "Waiting");
  const canDraw = !!event && !hasPendingWinner(data.registrations, event.id) && eligible.length > 0;
  const drawn = eventRegistrations.filter((row) => row.doorprizeStatus);

  function petFor(row: PortalRecord) {
    return data.pets.find((pet) => pet.id === row.petId);
  }
  function ownerFor(row: PortalRecord) {
    return data.users.find((user) => user.id === row.userId);
  }
  function competitionFor(row: PortalRecord) {
    return data.competitions.find((item) => item.id === row.competitionId);
  }

  function draw() {
    const target = pickRandom(eligible);
    if (!target) return;
    const now = new Date().toISOString();
    save("registrations", {
      ...target,
      doorprizeStatus: "Waiting",
      doorprizeDrawnAt: now,
      doorprizeStatusDate: now,
      updatedDate: now,
      updatedBy: "Admin Petpet",
    });
    toast.success((petFor(target)?.name ?? "Participant") + " drawn");
  }

  function resolve(status: "Claimed" | "Void") {
    if (!currentWinner) return;
    save("registrations", {
      ...currentWinner,
      doorprizeStatus: status,
      doorprizeStatusDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      updatedBy: "Admin Petpet",
    });
    toast.success("Winner status updated");
  }

  const columns: Column<PortalRecord>[] = [
    { key: "petId", label: "Participant ID", value: (row) => row.petId },
    { key: "ownerName", label: "Owner Name", value: (row) => ownerFor(row)?.name ?? "-" },
    { key: "petName", label: "Pet Name", value: (row) => petFor(row)?.name ?? "-" },
    { key: "competition", label: "Competition", value: (row) => competitionFor(row)?.name ?? "-" },
    {
      key: "drawnAt",
      label: "Doorprize Drawing Time",
      value: (row) => row.doorprizeDrawnAt ?? "",
      render: (row) => formatDateTime(row.doorprizeDrawnAt),
    },
    {
      key: "status",
      label: "Status",
      value: (row) => row.doorprizeStatus ?? "",
      render: (row) => (
        <span className={"status-badge status-" + (DOORPRIZE_STATUS_TONE[row.doorprizeStatus ?? ""] ?? "neutral")}>
          <span className="status-dot" />
          {row.doorprizeStatus}
        </span>
      ),
    },
    {
      key: "statusDate",
      label: "Status Date",
      value: (row) => row.doorprizeStatusDate ?? "",
      render: (row) => formatDateTime(row.doorprizeStatusDate),
    },
    {
      key: "createdDate",
      label: "Created Date",
      value: (row) => row.createdDate ?? "",
      render: (row) => formatDateTime(row.createdDate),
    },
    { key: "createdBy", label: "Created By", value: (row) => row.createdBy || "-" },
    {
      key: "updatedDate",
      label: "Updated Date",
      value: (row) => row.updatedDate ?? "",
      render: (row) => formatDateTime(row.updatedDate),
    },
    { key: "updatedBy", label: "Updated By", value: (row) => row.updatedBy || "-" },
  ];

  return (
    <div className="page-stack">
      <PageHeading
        title="Doorprize Drawing"
        description="Select an eligible event first, then randomly draw participant registrations for doorprizes."
      />
      <FindEvent events={data.events} onSelect={(item) => setSelectedEventId(item.id)} />
      {event && (
        <>
          <EventInfoCard event={event} />
          <EventPartners eventId={event.id} />
          <section className="form-section pet-detail-card">
            <div className="section-head">
              <div>
                <div className="eyebrow">DOORPRIZE PARTICIPANTS</div>
                <h2>Doorprize Drawing List</h2>
                <p className="muted">
                  Only participant registrations with Payment Status = Paid
                  are eligible. Each eligible registration can be drawn once.
                  Complete the current winner as Claimed or Void before
                  drawing again.
                </p>
              </div>
              <Button disabled={!canDraw} onClick={draw}>
                <Sparkles size={15} />
                Random Draw
              </Button>
            </div>
            {currentWinner && (
              <div className="assignment-note-card">
                <div>
                  <div className="eyebrow">CURRENT DRAW</div>
                  <strong>{petFor(currentWinner)?.name ?? "-"}</strong>
                  <p className="muted">
                    {ownerFor(currentWinner)?.name ?? "-"} /{" "}
                    {competitionFor(currentWinner)?.name ?? "-"}
                  </p>
                </div>
                <div className="assignment-builder">
                  <span className="status-badge status-warning">
                    <span className="status-dot" />
                    Waiting
                  </span>
                  <Select
                    aria-label="Update winner status"
                    value=""
                    onChange={(evt) => {
                      if (evt.target.value) resolve(evt.target.value as "Claimed" | "Void");
                    }}
                  >
                    <option value="">Update Winner Status</option>
                    <option value="Claimed">Claimed</option>
                    <option value="Void">Void</option>
                  </Select>
                </div>
              </div>
            )}
            <DataTable rows={drawn} columns={columns} label="Doorprize registrations" />
          </section>
        </>
      )}
    </div>
  );
}
