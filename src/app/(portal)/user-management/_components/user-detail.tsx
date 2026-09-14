"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/common/data-table";
import { formatDate, calculateAge } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { userInitials } from "../_lib/user-rules";

const BASE_PATH = "/user-management";

export function UserDetail({
  user,
  pets,
  onRequestDelete,
}: {
  user: PortalRecord;
  pets: PortalRecord[];
  onRequestDelete: () => void;
}) {
  const info: [string, string][] = [
    ["User ID", user.id],
    ["Username", user.username],
    ["First Name", user.firstName],
    ["Last Name", user.lastName || "-"],
    ["Email", user.email || "-"],
    ["Phone", user.phone],
    ["Date of Birth", formatDate(user.dob)],
    ["Gender", user.gender || "-"],
    ["Address", user.address || "-"],
    ["City", user.city || "-"],
    ["State / Province", user.province || "-"],
    ["Postal / ZIP Code", user.postalCode || "-"],
    ["Country", user.nation || "-"],
  ];
  const petColumns: Column<PortalRecord>[] = [
    { key: "id", label: "Pet ID", value: (row) => row.id },
    { key: "name", label: "Pet Name", value: (row) => row.name },
    { key: "animal", label: "Animal", value: (row) => row.animal },
    { key: "variant", label: "Variant", value: (row) => row.variant || "-" },
    { key: "gender", label: "Gender", value: (row) => row.gender || "-" },
    {
      key: "age",
      label: "Age",
      value: (row) => calculateAge(row.dob),
      render: (row) => calculateAge(row.dob),
    },
  ];
  return (
    <div className="page-stack">
      <div className="pet-detail-header">
        <Link className="back-link" href={BASE_PATH}>
          <ArrowLeft size={16} />
          Back to User Management
        </Link>
        <div className="row-actions">
          <Link className="link-button secondary" href={BASE_PATH + "/" + user.id + "/edit"}>
            <Pencil size={15} />
            Edit User
          </Link>
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 size={15} />
            Remove User
          </Button>
        </div>
      </div>
      <section className="form-section pet-detail-card">
        <div className="pet-detail-profile">
          {user.photo ? (
            <Image
              src={user.photo}
              width={72}
              height={72}
              unoptimized
              alt={user.name}
              className="image-preview image-preview-circle"
            />
          ) : (
            <span className="image-placeholder image-preview-circle" aria-hidden="true">
              {userInitials(user.firstName, user.lastName)}
            </span>
          )}
          <div>
            <div className="eyebrow">USER INFORMATION</div>
            <h2>{user.name}</h2>
            <p className="muted">@{user.username}</p>
          </div>
        </div>
        <dl className="detail-grid">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">OWNED PETS</div>
            <h2>Pet List</h2>
            <p className="muted">Pets registered under this user.</p>
          </div>
          <span className="user-pet-count">{pets.length} Pets</span>
        </div>
        <DataTable rows={pets} columns={petColumns} label="Owned pets" />
      </section>
    </div>
  );
}
