"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Download, Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import { exportCsv } from "@/lib/export-csv";
import { formatDate } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { brandInitials, SOCIAL_FIELDS } from "../_lib/brand-rules";

const BASE_PATH = "/sponsorship-brand";

export function BrandList({
  brands,
  onRequestDelete,
}: {
  brands: PortalRecord[];
  onRequestDelete: (brand: PortalRecord) => void;
}) {
  const [name, setName] = useState("");
  const filtered = brands.filter((brand) =>
    brand.name.toLowerCase().includes(name.toLowerCase()),
  );
  const columns: Column<PortalRecord>[] = [
    {
      key: "logo",
      label: "Brand Logo",
      value: (row) => row.name,
      render: (row) =>
        row.logo ? (
          <Image
            src={row.logo}
            width={36}
            height={36}
            unoptimized
            alt=""
            className="image-preview image-preview-circle"
          />
        ) : (
          <span className="record-initials">{brandInitials(row.name)}</span>
        ),
    },
    { key: "id", label: "Brand ID", value: (row) => row.id },
    {
      key: "name",
      label: "Brand Name",
      value: (row) => row.name,
      render: (row) => (
        <div className="record-name">
          <div>
            <strong>{row.name}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    { key: "phone", label: "Phone", value: (row) => row.phone },
    { key: "campaign", label: "Brand Campaign", value: (row) => row.campaign || "-" },
    ...SOCIAL_FIELDS.map(
      (field): Column<PortalRecord> => ({
        key: field.key,
        label: field.label,
        value: (row) => row[field.key] || "-",
      }),
    ),
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
        title="Brands"
        description="Manage sponsor brands, partnership tiers, campaigns, social accounts, and sponsorship records."
        actions={
          <Link href={BASE_PATH + "/create"} className="link-button">
            <Plus size={16} />
            Add New Brand
          </Link>
        }
      />
      <section>
        <div className="toolbar">
          <Field label="Brand name">
            <Input
              type="search"
              placeholder="Search brand name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <div className="toolbar-actions">
            <Button variant="secondary" onClick={() => setName("")}>
              <RotateCcw size={14} />
              Clear Filter
            </Button>
            <Button
              variant="secondary"
              disabled={!filtered.length}
              onClick={() => exportCsv("Brands", filtered)}
            >
              <Download size={14} />
              Export CSV
            </Button>
          </div>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Brands"
          actions={(brand) => (
            <>
              <Link
                href={BASE_PATH + "/" + brand.id}
                title={"View " + brand.name}
                aria-label={"View " + brand.name}
              >
                <Eye size={15} />
              </Link>
              <Link
                href={BASE_PATH + "/" + brand.id + "/edit"}
                title={"Edit " + brand.name}
                aria-label={"Edit " + brand.name}
              >
                <Pencil size={14} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title={"Delete " + brand.name}
                aria-label={"Delete " + brand.name}
                onClick={() => onRequestDelete(brand)}
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
