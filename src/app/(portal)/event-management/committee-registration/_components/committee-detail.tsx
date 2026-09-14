"use client";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalRecord } from "@/types/portal";
import { RolePill } from "@/app/(portal)/event-management/_components/role-pill";

const BASE_PATH = "/event-management/committee-registration";

export function CommitteeDetail({
  record,
  user,
  event,
  competition,
  onRequestDelete,
}: {
  record: PortalRecord;
  user?: PortalRecord;
  event?: PortalRecord;
  competition?: PortalRecord;
  onRequestDelete: () => void;
}) {
  return (
    <div className="page-stack">
      <div className="pet-detail-header">
        <Link className="back-link" href={BASE_PATH}>
          <ArrowLeft size={16} />
          Back to Committee Registration
        </Link>
        <div className="row-actions">
          <Link className="link-button secondary" href={BASE_PATH + "/" + record.id + "/edit"}>
            <Pencil size={15} />
            Edit Assignment
          </Link>
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 size={15} />
            Remove Assignment
          </Button>
        </div>
      </div>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">COMMITTEE ASSIGNMENT</div>
            <h2>{user?.name ?? record.userId}</h2>
            <p className="muted">{event?.name ?? record.eventId}</p>
          </div>
          <RolePill role={record.role} />
        </div>
        <dl className="detail-grid">
          <div>
            <dt>User ID</dt>
            <dd>{record.userId}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{user?.phone || "-"}</dd>
          </div>
          <div>
            <dt>Event</dt>
            <dd>{event?.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Competition</dt>
            <dd>{competition?.name ?? "All competitions"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{record.role}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
