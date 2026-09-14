"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, calculateAge } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { petInitials } from "../_lib/pet-rules";

const BASE_PATH = "/pet-management";

export function PetDetail({
  pet,
  onRequestDelete,
}: {
  pet: PortalRecord;
  onRequestDelete: () => void;
}) {
  const info: [string, string][] = [
    ["Pet ID", pet.id],
    ["Pet Name", pet.name],
    ["Animal", pet.animal],
    ["Variant", pet.variant || "-"],
    ["Owner", pet.ownerName],
    ["Gender", pet.gender || "-"],
    ["Date of Birth", formatDate(pet.dob)],
    ["Age", calculateAge(pet.dob)],
    ["Height / Length", pet.heightLength || "-"],
    ["Weight", pet.weight || "-"],
  ];
  return (
    <div className="page-stack">
      <div className="pet-detail-header">
        <Link className="back-link" href={BASE_PATH}>
          <ArrowLeft size={16} />
          Back to Pet Management
        </Link>
        <div className="row-actions">
          <Link className="link-button secondary" href={BASE_PATH + "/" + pet.id + "/edit"}>
            <Pencil size={15} />
            Edit Pet
          </Link>
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 size={15} />
            Remove Pet
          </Button>
        </div>
      </div>
      <section className="form-section pet-detail-card">
        <div className="pet-detail-profile">
          {pet.photo ? (
            <Image
              src={pet.photo}
              width={72}
              height={72}
              unoptimized
              alt={pet.name}
              className="image-preview image-preview-circle"
            />
          ) : (
            <span className="image-placeholder image-preview-circle" aria-hidden="true">
              {petInitials(pet.name)}
            </span>
          )}
          <div>
            <div className="eyebrow">PET INFORMATION</div>
            <h2>{pet.name}</h2>
            <p className="muted">Owned by {pet.ownerName}</p>
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
        <div className="pet-audit-section">
          <div className="eyebrow">AUDIT INFORMATION</div>
          <h3>Record History</h3>
          <dl className="detail-grid">
            <div>
              <dt>Created Date</dt>
              <dd>{formatDateTime(pet.createdDate)}</dd>
            </div>
            <div>
              <dt>Created By</dt>
              <dd>{pet.createdBy || "-"}</dd>
            </div>
            <div>
              <dt>Updated Date</dt>
              <dd>{formatDateTime(pet.updatedDate)}</dd>
            </div>
            <div>
              <dt>Updated By</dt>
              <dd>{pet.updatedBy || "-"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
