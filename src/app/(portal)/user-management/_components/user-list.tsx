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
import { userInitials } from "../_lib/user-rules";

const BASE_PATH = "/user-management";

export function UserList({
  users,
  onRequestDelete,
}: {
  users: PortalRecord[];
  onRequestDelete: (user: PortalRecord) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const filtered = users.filter(
    (user) =>
      (user.firstName + " " + user.lastName)
        .toLowerCase()
        .includes(name.toLowerCase()) &&
      user.phone.includes(phone),
  );
  function clearFilters() {
    setName("");
    setPhone("");
  }
  const columns: Column<PortalRecord>[] = [
    { key: "id", label: "User ID", value: (row) => row.id },
    { key: "username", label: "Username", value: (row) => row.username },
    {
      key: "firstName",
      label: "First Name",
      value: (row) => row.firstName,
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
            <span className="record-initials">
              {userInitials(row.firstName, row.lastName)}
            </span>
          )}
          <div>
            <strong>{row.firstName}</strong>
            <small>{row.id}</small>
          </div>
        </div>
      ),
    },
    { key: "lastName", label: "Last Name", value: (row) => row.lastName || "-" },
    { key: "email", label: "Email", value: (row) => row.email || "-" },
    { key: "phone", label: "Phone", value: (row) => row.phone },
    { key: "gender", label: "Gender", value: (row) => row.gender || "-" },
    { key: "city", label: "City", value: (row) => row.city || "-" },
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
        title="User Management"
        description="Manage platform users, contact information, and user records."
        actions={
          <Link href={BASE_PATH + "/create"} className="link-button">
            <Plus size={16} />
            Add User
          </Link>
        }
      />
      <section>
        <div className="toolbar">
          <Field label="Name">
            <Input
              type="search"
              placeholder="Search first or last name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input
              type="search"
              placeholder="Search phone number"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <div className="toolbar-actions">
            <Button variant="secondary" onClick={clearFilters}>
              <RotateCcw size={14} />
              Clear Filter
            </Button>
            <Button
              variant="secondary"
              disabled={!filtered.length}
              onClick={() => exportCsv("User Management", filtered)}
            >
              <Download size={14} />
              Export CSV
            </Button>
          </div>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Users"
          actions={(user) => (
            <>
              <Link
                href={BASE_PATH + "/" + user.id}
                title={"View " + user.name}
                aria-label={"View " + user.name}
              >
                <Eye size={15} />
              </Link>
              <Link
                href={BASE_PATH + "/" + user.id + "/edit"}
                title={"Edit " + user.name}
                aria-label={"Edit " + user.name}
              >
                <Pencil size={14} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                title={"Delete " + user.name}
                aria-label={"Delete " + user.name}
                onClick={() => onRequestDelete(user)}
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
