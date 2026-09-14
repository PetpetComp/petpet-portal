"use client";
import { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { PAYMENT_STATUSES } from "../_lib/registration-rules";
import { RegisterPetForm } from "./register-pet-form";

interface RegistrationRow {
  id: string;
  paymentStatus: string;
  petName: string;
  competitionName: string;
  animal: string;
  variant: string;
  priceCategory: string;
  registrationDate?: string;
  registrationFee?: number;
  paymentDate?: string;
  paymentMethod?: string;
  paymentVerificationDate?: string;
  paymentVerifiedBy?: string;
  createdDate?: string;
  createdBy?: string;
  updatedDate?: string;
  updatedBy?: string;
}

export function RegistrationTable({
  event,
  user,
  pets,
  competitions,
  registrations,
  onSave,
}: {
  event: PortalRecord;
  user: PortalRecord;
  pets: PortalRecord[];
  competitions: PortalRecord[];
  registrations: PortalRecord[];
  onSave: (registration: PortalRecord) => void;
}) {
  const [petName, setPetName] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [registering, setRegistering] = useState(false);

  const userRegistrations = registrations.filter(
    (row) => row.eventId === event.id && row.userId === user.id,
  );

  const rows: RegistrationRow[] = userRegistrations
    .map((row) => {
      const pet = pets.find((item) => item.id === row.petId);
      const competition = competitions.find((item) => item.id === row.competitionId);
      return {
        id: row.id,
        paymentStatus: row.paymentStatus,
        petName: pet?.name ?? "-",
        competitionName: competition?.name ?? "-",
        animal: pet?.animal ?? "-",
        variant: pet?.variant ?? "-",
        priceCategory: row.priceCategory ?? "-",
        registrationDate: row.registrationDate,
        registrationFee: Number(row.registrationFee || 0),
        paymentDate: row.paymentDate,
        paymentMethod: row.paymentMethod,
        paymentVerificationDate: row.paymentVerificationDate,
        paymentVerifiedBy: row.paymentVerifiedBy,
        createdDate: row.createdDate,
        createdBy: row.createdBy,
        updatedDate: row.updatedDate,
        updatedBy: row.updatedBy,
      };
    })
    .filter(
      (row) =>
        row.petName.toLowerCase().includes(petName.toLowerCase()) &&
        row.competitionName.toLowerCase().includes(competitionName.toLowerCase()) &&
        (!paymentStatus || row.paymentStatus === paymentStatus),
    );

  const columns: Column<RegistrationRow>[] = [
    {
      key: "paymentStatus",
      label: "Payment Status",
      value: (row) => row.paymentStatus,
      render: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    { key: "petName", label: "Pet Name", value: (row) => row.petName },
    { key: "competitionName", label: "Competition", value: (row) => row.competitionName },
    { key: "animal", label: "Animal", value: (row) => row.animal },
    { key: "variant", label: "Variant", value: (row) => row.variant },
    { key: "priceCategory", label: "Price Category", value: (row) => row.priceCategory },
    {
      key: "registrationDate",
      label: "Registration Date",
      value: (row) => row.registrationDate ?? "",
      render: (row) => formatDate(row.registrationDate),
    },
    {
      key: "registrationFee",
      label: "Registration Fee",
      value: (row) => row.registrationFee ?? 0,
      render: (row) => "Rp " + (row.registrationFee ?? 0).toLocaleString("id-ID"),
    },
    {
      key: "paymentDate",
      label: "Payment Date",
      value: (row) => row.paymentDate ?? "",
      render: (row) => formatDate(row.paymentDate),
    },
    { key: "paymentMethod", label: "Payment Method", value: (row) => row.paymentMethod || "-" },
    {
      key: "paymentVerificationDate",
      label: "Payment Verification Date",
      value: (row) => row.paymentVerificationDate ?? "",
      render: (row) => formatDate(row.paymentVerificationDate),
    },
    { key: "paymentVerifiedBy", label: "Payment Verified By", value: (row) => row.paymentVerifiedBy || "-" },
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
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">REGISTRATION LIST</div>
          <h2>Registered Pets</h2>
          <p className="muted">Pet and competition registration data for the selected event.</p>
        </div>
        <Button onClick={() => setRegistering((current) => !current)}>
          <Plus size={15} />
          Register Pet
        </Button>
      </div>
      {registering && (
        <RegisterPetForm
          event={event}
          user={user}
          pets={pets}
          competitions={competitions}
          registrations={registrations}
          onSave={(registration) => {
            onSave(registration);
            setRegistering(false);
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
          <Select value={paymentStatus} onChange={(evt) => setPaymentStatus(evt.target.value)}>
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((status) => (
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
      <DataTable rows={rows} columns={columns} label="Registered pets" />
    </section>
  );
}
