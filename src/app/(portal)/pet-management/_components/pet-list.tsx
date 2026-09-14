"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Download, Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import { exportCsv } from "@/lib/export-csv";
import { formatDate, calculateAge } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { ANIMAL_OPTIONS, petInitials } from "../_lib/pet-rules";

const BASE_PATH = "/pet-management";

export function PetList({
  pets,
  onRequestDelete,
}: {
  pets: PortalRecord[];
  onRequestDelete: (pet: PortalRecord) => void;
}) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [animal, setAnimal] = useState("");
  const [variant, setVariant] = useState("");
  const variants = Array.from(new Set(pets.map((pet) => pet.variant))).filter(
    Boolean,
  );
  const filtered = pets.filter(
    (pet) =>
      pet.name.toLowerCase().includes(name.toLowerCase()) &&
      pet.ownerName.toLowerCase().includes(owner.toLowerCase()) &&
      (!animal || pet.animal === animal) &&
      (!variant || pet.variant === variant),
  );
  function clearFilters() {
    setName("");
    setOwner("");
    setAnimal("");
    setVariant("");
  }
  const columns: Column<PortalRecord>[] = [
    { key: "id", label: "Pet ID", value: (row) => row.id },
    {
      key: "name",
      label: "Pet Name",
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
              className="image-preview image-preview-circle"
            />
          ) : (
            <span className="record-initials">{petInitials(row.name)}</span>
          )}
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    { key: "animal", label: "Animal", value: (row) => row.animal },
    { key: "variant", label: "Variant", value: (row) => row.variant },
    { key: "ownerName", label: "Owner", value: (row) => row.ownerName },
    { key: "gender", label: "Gender", value: (row) => row.gender || "-" },
    {
      key: "age",
      label: "Age",
      value: (row) => calculateAge(row.dob),
      render: (row) => calculateAge(row.dob),
    },
    { key: "heightLength", label: "Height / Length", value: (row) => row.heightLength || "-" },
    { key: "weight", label: "Weight", value: (row) => row.weight || "-" },
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
        title="Pet Management"
        description="Manage registered pets, ownership information, and pet records."
        actions={
          <Link href={BASE_PATH + "/create"} className="link-button">
            <Plus size={16} />
            Add Pet
          </Link>
        }
      />
      <section>
        <div className="toolbar">
          <Field label="Pet name">
            <Input
              type="search"
              placeholder="Search pet name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Owner">
            <Input
              type="search"
              placeholder="Search owner name"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
          </Field>
          <Field label="Animal">
            <Select
              value={animal}
              onChange={(event) => setAnimal(event.target.value)}
            >
              <option value="">All animals</option>
              {ANIMAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Variant">
            <Select
              value={variant}
              onChange={(event) => setVariant(event.target.value)}
            >
              <option value="">All variants</option>
              {variants.map((option) => (
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
            <Button
              variant="secondary"
              disabled={!filtered.length}
              onClick={() => exportCsv("Pet Management", filtered)}
            >
              <Download size={14} />
              Export CSV
            </Button>
          </div>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Pets"
          actions={(pet) => (
            <>
              <Link
                href={BASE_PATH + "/" + pet.id}
                title={"View " + pet.name}
                aria-label={"View " + pet.name}
              >
                <Eye size={15} />
              </Link>
              <Link
                href={BASE_PATH + "/" + pet.id + "/edit"}
                title={"Edit " + pet.name}
                aria-label={"Edit " + pet.name}
              >
                <Pencil size={14} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title={"Delete " + pet.name}
                aria-label={"Delete " + pet.name}
                onClick={() => onRequestDelete(pet)}
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
