"use client";
import Link from "next/link";
import { Pencil, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDateTime, formatDate } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { EventInfoCard } from "@/app/(portal)/event-management/_components/event-info-card";
import { CompetitionCommittee } from "./competition-committee";
import { CompetitionParticipants } from "./competition-participants";
import { REGISTRATION_CHANNELS, canCloseRegistration, parseContestCriteria, runPathFor, typeConfigFields } from "../_lib/competition-rules";

export function CompetitionDetail({
  event,
  competition,
  users,
  committee,
  participants,
  onAddCommittee,
  onRemoveCommittee,
  onCloseRegistration,
}: {
  event: PortalRecord;
  competition: PortalRecord;
  users: PortalRecord[];
  committee: PortalRecord[];
  participants: Parameters<typeof CompetitionParticipants>[0]["rows"];
  onAddCommittee: (member: PortalRecord) => void;
  onRemoveCommittee: (id: string) => void;
  onCloseRegistration: () => void;
}) {
  const config = typeConfigFields(competition.type);
  const editPath = "/event-management/" + event.id + "/competitions/" + competition.id + "/edit";

  return (
    <div className="page-stack">
      <Link className="back-link" href={"/event-management/" + event.id}>
        Back to Event Details
      </Link>
      <div className="pet-detail-header">
        <div>
          <h1>{competition.name}</h1>
          <p className="muted">Competition information — {competition.type}</p>
        </div>
        <div className="row-actions">
          {canCloseRegistration(competition.registrationStatus) && (
            <Button variant="secondary" onClick={onCloseRegistration}>
              Close Registration
            </Button>
          )}
          <Link
            className="link-button secondary"
            href={
              "/competition/" +
              competition.id +
              "/" +
              runPathFor(competition.type)
            }
          >
            <Shuffle size={15} />
            Run Competition
          </Link>
          <Link className="link-button" href={editPath}>
            <Pencil size={15} />
            Edit Competition
          </Link>
        </div>
      </div>
      <EventInfoCard event={event} />
      {(config.lanes || config.checkpoints || config.cutoff || competition.type === "Contest") && (
        <section className="form-section pet-detail-card">
          <div className="eyebrow">TYPE-SPECIFIC INFORMATION</div>
          <h2>Competition Configuration</h2>
          <dl className="detail-grid">
            {config.lanes && (
              <div>
                <dt>Number of Lanes</dt>
                <dd>{competition.lanes || 4}</dd>
              </div>
            )}
            {config.checkpoints && (
              <div>
                <dt>Number of Checkpoints</dt>
                <dd>{competition.checkpoints || 3}</dd>
              </div>
            )}
            {config.cutoff && (
              <div>
                <dt>Cutoff Time</dt>
                <dd>{competition.cutoff || 60} seconds</dd>
              </div>
            )}
            {competition.type === "Contest" && (
              <div>
                <dt>Judging Criteria</dt>
                <dd>
                  {parseContestCriteria(competition.contestCriteria)
                    .map((item) => item.name + " (max " + item.maxPoints + ")")
                    .join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
      <section className="form-section pet-detail-card">
        <div className="eyebrow">GENERAL INFORMATION</div>
        <h2>Competition Information</h2>
        <dl className="detail-grid">
          <div>
            <dt>Competition Name</dt>
            <dd>{competition.name}</dd>
          </div>
          <div>
            <dt>Competition Type</dt>
            <dd>{competition.type}</dd>
          </div>
          <div>
            <dt>Animal</dt>
            <dd>{competition.animal}</dd>
          </div>
        </dl>
      </section>
      <section className="form-section pet-detail-card">
        <div className="eyebrow">REGISTRATION &amp; PRICING</div>
        <h2>Registration Channels</h2>
        <dl className="detail-grid">
          <div>
            <dt>Registration Status</dt>
            <dd>
              <StatusBadge status={competition.registrationStatus || "Open"} />
            </dd>
          </div>
          <div>
            <dt>Registration Closed Date</dt>
            <dd>{formatDateTime(competition.registrationClosedDate)}</dd>
          </div>
          <div>
            <dt>Closed By</dt>
            <dd>{competition.registrationClosedBy || "-"}</dd>
          </div>
        </dl>
        <div className="registration-channels">
          {REGISTRATION_CHANNELS.map((channel) => (
            <div key={channel.key} className="registration-channel-card">
              <strong>{channel.label}</strong>
              <dl className="detail-grid">
                <div>
                  <dt>Price</dt>
                  <dd>
                    Rp {Number(competition[channel.key + "Price"] || 0).toLocaleString("id-ID")}
                  </dd>
                </div>
                <div>
                  <dt>Open Date</dt>
                  <dd>{formatDate(competition[channel.key + "Open"])}</dd>
                </div>
                <div>
                  <dt>Closed Date</dt>
                  <dd>{formatDate(competition[channel.key + "Close"])}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
      <CompetitionCommittee
        competitionId={competition.id}
        users={users}
        members={committee}
        onAdd={onAddCommittee}
        onRemove={onRemoveCommittee}
      />
      <CompetitionParticipants rows={participants} />
      <div className="pet-audit-section">
        <div className="eyebrow">AUDIT INFORMATION</div>
        <h3>Record History</h3>
        <dl className="detail-grid">
          <div>
            <dt>Created Date</dt>
            <dd>{formatDateTime(competition.createdDate)}</dd>
          </div>
          <div>
            <dt>Created By</dt>
            <dd>{competition.createdBy || "-"}</dd>
          </div>
          <div>
            <dt>Updated Date</dt>
            <dd>{formatDateTime(competition.updatedDate)}</dd>
          </div>
          <div>
            <dt>Updated By</dt>
            <dd>{competition.updatedBy || "-"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
