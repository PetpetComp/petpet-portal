"use client";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import {
  DataTable,
  type Column,
  type ServerPagination,
} from "@/components/common/data-table";
import { PageHeading } from "@/components/common/page-heading";
import { initials } from "@/lib/identity";
import type { Organization } from "@/types/organization";

export function OrganizationList({
  organizations,
  query,
  onQueryChange,
  server,
  loadError,
}: {
  organizations: Organization[];
  query: string;
  onQueryChange: (query: string) => void;
  server: ServerPagination;
  loadError?: string;
}) {
  const columns: Column<Organization>[] = [
    {
      key: "photo",
      label: "Organization Photo",
      render: (row) =>
        row.photo ? (
          <Image
            src={row.photo}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="image-preview"
          />
        ) : (
          <span className="record-initials">{initials(row.name, "O")}</span>
        ),
    },
    { key: "name", label: "Organization Name", value: (row) => row.name },
    { key: "campaign", label: "Campaign", value: (row) => row.campaign || "—" },
    {
      key: "pics",
      label: "PIC List",
      value: (row) => row.pics.map((pic) => pic.name).join(", "),
      render: (row) =>
        row.pics.length ? (
          <div className="grid gap-2">
            {row.pics.map((pic) => (
              <div key={pic.id} className="record-name">
                <div>
                  <strong>{pic.name}</strong>
                  <small>
                    {[pic.email, pic.phone].filter(Boolean).join(" · ")}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="muted">No PICs assigned</span>
        ),
    },
  ];
  return (
    <section className="page-stack">
      <PageHeading
        title="Organization Management"
        description="Manage organizations, campaigns, and PICs."
        actions={
          <Link
            className={buttonVariants()}
            href="/organization-management/create"
          >
            <Plus size={16} />
            Add New Organization
          </Link>
        }
      />
      <div className="toolbar">
        <Field label="Search organizations">
          <Input
            type="search"
            placeholder="Search organization, campaign, or PIC"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </Field>
      </div>
      {loadError && (
        <p role="alert" className="form-error">
          {loadError}
        </p>
      )}
      <DataTable
        rows={organizations}
        columns={columns}
        label="Organizations"
        server={server}
        actions={(organization) => (
          <Link
            href={
              "/organization-management/" +
              encodeURIComponent(organization.id) +
              "/edit"
            }
            aria-label={"Edit " + organization.name}
            title={"Edit " + organization.name}
          >
            <Pencil size={16} />
          </Link>
        )}
      />
    </section>
  );
}
