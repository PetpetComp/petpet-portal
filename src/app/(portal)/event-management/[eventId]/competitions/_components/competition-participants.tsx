"use client";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import type { PortalRecord } from "@/types/portal";

interface ParticipantRow extends PortalRecord {
  ownerName: string;
  petName: string;
  animal: string;
  variant: string;
  phone: string;
  paymentStatus: string;
}

export function CompetitionParticipants({ rows }: { rows: ParticipantRow[] }) {
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [animal, setAnimal] = useState("");
  const [variant, setVariant] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const filtered = rows.filter(
    (row) =>
      row.ownerName.toLowerCase().includes(owner.toLowerCase()) &&
      row.phone.includes(phone) &&
      row.petName.toLowerCase().includes(petName.toLowerCase()) &&
      row.animal.toLowerCase().includes(animal.toLowerCase()) &&
      row.variant.toLowerCase().includes(variant.toLowerCase()) &&
      (!paymentStatus || row.paymentStatus === paymentStatus),
  );

  const columns: Column<ParticipantRow>[] = [
    {
      key: "paymentStatus",
      label: "Payment Status",
      value: (row) => row.paymentStatus,
      render: (row) => <StatusBadge status={row.paymentStatus} />,
    },
    { key: "ownerName", label: "Owner Name", value: (row) => row.ownerName },
    { key: "petName", label: "Pet Name", value: (row) => row.petName },
    { key: "animal", label: "Animal", value: (row) => row.animal },
    { key: "variant", label: "Variant", value: (row) => row.variant || "-" },
    { key: "phone", label: "Phone", value: (row) => row.phone },
  ];

  return (
    <section className="form-section pet-detail-card">
      <div className="section-head">
        <div>
          <div className="eyebrow">COMPETITION PARTICIPANTS</div>
          <h2>Competition Participants</h2>
          <p className="muted">
            Pets registered to compete in this competition. Owner and pet
            information is sourced from Pet Management.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <Field label="Owner name">
          <Input type="search" value={owner} onChange={(event) => setOwner(event.target.value)} />
        </Field>
        <Field label="Phone">
          <Input type="search" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Pet name">
          <Input type="search" value={petName} onChange={(event) => setPetName(event.target.value)} />
        </Field>
        <Field label="Animal">
          <Input type="search" value={animal} onChange={(event) => setAnimal(event.target.value)} />
        </Field>
        <Field label="Variant">
          <Input type="search" value={variant} onChange={(event) => setVariant(event.target.value)} />
        </Field>
        <Field label="Payment status">
          <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Verified">Verified</option>
          </Select>
        </Field>
      </div>
      <DataTable rows={filtered} columns={columns} label="Competition participants" />
    </section>
  );
}
