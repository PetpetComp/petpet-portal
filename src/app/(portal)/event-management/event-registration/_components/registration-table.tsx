"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { ENTRY_SERVICES } from "@/services/event-operations";
import type { PortalRecord } from "@/types/portal";
import { RegisterPetForm } from "./register-pet-form";

interface RegistrationRow {
  id: string;
  paymentStatus: string;
  checkinStatus: string;
  status: string;
  petName: string;
  competitionName: string;
  registrationFee?: string;
}

export function RegistrationTable({
  event,
  pets,
  competitions,
  registrations,
}: {
  event: PortalRecord;
  pets: PortalRecord[];
  competitions: PortalRecord[];
  registrations: PortalRecord[];
}) {
  const { refresh, remove } = usePortalData();
  const [petName, setPetName] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [registering, setRegistering] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [actionError, setActionError] = useState("");

  const paymentStatuses = Array.from(
    new Set(registrations.map((row) => row.paymentStatus).filter(Boolean)),
  );

  const rows: RegistrationRow[] = registrations
    .filter((row) => row.eventId === event.id)
    .map((row) => {
      const pet = pets.find((item) => item.id === row.petId);
      const competition = competitions.find(
        (item) => item.id === row.competitionId,
      );
      return {
        id: row.id,
        paymentStatus: row.paymentStatus || "-",
        checkinStatus: row.checkinStatus || "-",
        status: row.status || "-",
        petName: pet?.name ?? "-",
        competitionName: competition?.name ?? "-",
        registrationFee: row.registrationFee,
      };
    })
    .filter(
      (row) =>
        row.petName.toLowerCase().includes(petName.toLowerCase()) &&
        row.competitionName
          .toLowerCase()
          .includes(competitionName.toLowerCase()) &&
        (!paymentStatus || row.paymentStatus === paymentStatus),
    );

  async function runAction(id: string, action: "approve" | "reject" | "checkin") {
    if (pendingId) return;
    setPendingId(id);
    setActionError("");
    try {
      await ENTRY_SERVICES[action](id);
      toast.success("Entry updated");
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to update entry.",
      );
    } finally {
      setPendingId("");
    }
  }

  const columns: Column<RegistrationRow>[] = [
    {
      key: "paymentStatus",
      label: "Payment Status",
      value: (row) => row.paymentStatus,
      render: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    {
      key: "checkinStatus",
      label: "Check-in",
      value: (row) => row.checkinStatus,
    },
    { key: "petName", label: "Pet Name", value: (row) => row.petName },
    {
      key: "competitionName",
      label: "Competition",
      value: (row) => row.competitionName,
    },
    {
      key: "registrationFee",
      label: "Registration Fee",
      value: (row) => row.registrationFee ?? "",
      render: (row) => (row.registrationFee ? "Rp " + row.registrationFee : "-"),
    },
    {
      key: "status",
      label: "Status",
      value: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">REGISTRATION LIST</div>
          <h2>Registered Pets</h2>
          <p className="muted">
            Pet and competition registration data for the selected event.
          </p>
        </div>
        <Button onClick={() => setRegistering((current) => !current)}>
          <Plus size={15} />
          Register Pet
        </Button>
      </div>
      {registering && (
        <RegisterPetForm
          competitions={competitions}
          onSaved={() => {
            setRegistering(false);
            void refresh();
          }}
          onCancel={() => setRegistering(false)}
        />
      )}
      <div className="toolbar">
        <Field label="Pet name">
          <Input
            type="search"
            placeholder="Search or select pet name"
            value={petName}
            onChange={(evt) => setPetName(evt.target.value)}
          />
        </Field>
        <Field label="Competition name">
          <Input
            type="search"
            placeholder="Search or select competition name"
            value={competitionName}
            onChange={(evt) => setCompetitionName(evt.target.value)}
          />
        </Field>
        <Field label="Payment status">
          <Select
            value={paymentStatus}
            onChange={(evt) => setPaymentStatus(evt.target.value)}
          >
            <option value="">All statuses</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>
        <div className="toolbar-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setPetName("");
              setCompetitionName("");
              setPaymentStatus("");
            }}
          >
            <RotateCcw size={14} />
            Clear Search
          </Button>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        label="Registered pets"
        actions={(row) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              title="Approve entry"
              aria-label="Approve entry"
              disabled={!!pendingId}
              onClick={() => void runAction(row.id, "approve")}
            >
              <CheckCircle2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Reject entry"
              aria-label="Reject entry"
              disabled={!!pendingId}
              onClick={() => void runAction(row.id, "reject")}
            >
              <XCircle size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Check in"
              aria-label="Check in"
              disabled={!!pendingId}
              onClick={() => void runAction(row.id, "checkin")}
            >
              <ClipboardCheck size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Remove entry"
              aria-label="Remove entry"
              disabled={!!pendingId}
              onClick={async () => {
                if (!window.confirm("Remove this registration?")) return;
                setPendingId(row.id);
                try {
                  await remove("registrations", row.id);
                  toast.success("Entry removed");
                } catch (cause) {
                  setActionError(
                    cause instanceof Error
                      ? cause.message
                      : "Unable to remove entry.",
                  );
                } finally {
                  setPendingId("");
                }
              }}
            >
              <Trash2 size={16} />
            </Button>
          </>
        )}
      />
      {actionError && (
        <p role="alert" className="form-error">
          {actionError}
        </p>
      )}
    </section>
  );
}
