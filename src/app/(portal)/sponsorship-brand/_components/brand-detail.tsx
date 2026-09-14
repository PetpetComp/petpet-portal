"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/common/data-table";
import { formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { brandInitials, SOCIAL_FIELDS } from "../_lib/brand-rules";
import { BrandEventAssignment } from "./brand-event-assignment";
import { SocialIcon } from "./social-icon";

const BASE_PATH = "/sponsorship-brand";

export function BrandDetail({
  brand,
  pics,
  events,
  assignments,
  onAddAssignment,
  onRemoveAssignment,
  onRequestDelete,
}: {
  brand: PortalRecord;
  pics: PortalRecord[];
  events: PortalRecord[];
  assignments: PortalRecord[];
  onAddAssignment: (assignment: PortalRecord) => void;
  onRemoveAssignment: (id: string) => void;
  onRequestDelete: () => void;
}) {
  const picColumns: Column<PortalRecord>[] = [
    { key: "firstName", label: "First Name", value: (row) => row.firstName },
    { key: "lastName", label: "Last Name", value: (row) => row.lastName || "-" },
    { key: "phone", label: "Phone", value: (row) => row.phone },
  ];
  return (
    <div className="page-stack">
      <div className="pet-detail-header">
        <Link className="back-link" href={BASE_PATH}>
          <ArrowLeft size={16} />
          Back to Brands
        </Link>
        <div className="row-actions">
          <Link className="link-button secondary" href={BASE_PATH + "/" + brand.id + "/edit"}>
            <Pencil size={15} />
            Edit Brand
          </Link>
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 size={15} />
            Remove Brand
          </Button>
        </div>
      </div>
      <section className="form-section pet-detail-card">
        <div className="pet-detail-profile">
          {brand.logo ? (
            <Image
              src={brand.logo}
              width={72}
              height={72}
              unoptimized
              alt={brand.name}
              className="image-preview image-preview-circle"
            />
          ) : (
            <span className="image-placeholder image-preview-circle" aria-hidden="true">
              {brandInitials(brand.name)}
            </span>
          )}
          <div>
            <div className="eyebrow">BRAND</div>
            <h2>{brand.name}</h2>
            <p className="muted">{brand.campaign || "No campaign set"}</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Brand ID</dt>
            <dd>{brand.id}</dd>
          </div>
          <div>
            <dt>Brand Name</dt>
            <dd>{brand.name}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{brand.phone}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{brand.email || "-"}</dd>
          </div>
          {SOCIAL_FIELDS.map((field) => (
            <div key={field.key}>
              <dt className="social-info-row">
                <SocialIcon icon={field.icon} />
                {field.label}
              </dt>
              <dd>{brand[field.key] || "-"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">BRAND PICS</div>
            <h2>Brand PICs</h2>
            <p className="muted">PIC assigned to this brand from User Management.</p>
          </div>
          <span className="user-pet-count">{pics.length} PICs</span>
        </div>
        <DataTable rows={pics} columns={picColumns} label="Brand PICs" />
      </section>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">PARTNERSHIP ASSIGNMENT</div>
            <h2>Event Partnership Assignments</h2>
            <p className="muted">
              Manage which events this brand sponsors and the category for
              each event.
            </p>
          </div>
        </div>
        <BrandEventAssignment
          brandId={brand.id}
          events={events}
          assignments={assignments}
          onAdd={onAddAssignment}
          onRemove={onRemoveAssignment}
        />
      </section>
      <div className="pet-audit-section">
        <div className="eyebrow">AUDIT INFORMATION</div>
        <h3>Record History</h3>
        <dl className="detail-grid">
          <div>
            <dt>Created Date</dt>
            <dd>{formatDateTime(brand.createdDate)}</dd>
          </div>
          <div>
            <dt>Created By</dt>
            <dd>{brand.createdBy || "-"}</dd>
          </div>
          <div>
            <dt>Updated Date</dt>
            <dd>{formatDateTime(brand.updatedDate)}</dd>
          </div>
          <div>
            <dt>Updated By</dt>
            <dd>{brand.updatedBy || "-"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
