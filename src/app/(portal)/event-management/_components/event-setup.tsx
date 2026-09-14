"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, Handshake, Play, Plus } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { CategoryPill } from "@/components/common/category-pill";
import { formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";
import { eventInitials } from "../_lib/event-rules";
import { runPathFor } from "@/app/(portal)/event-management/[eventId]/competitions/_lib/competition-rules";

const BASE_PATH = "/event-management";

export function EventSetup({
  event,
  competitions,
  sponsors,
}: {
  event: PortalRecord;
  competitions: PortalRecord[];
  sponsors: (PortalRecord & { category: string })[];
}) {
  const [competitionQuery, setCompetitionQuery] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorCategory, setSponsorCategory] = useState("");

  const filteredCompetitions = competitions.filter((item) =>
    item.name.toLowerCase().includes(competitionQuery.toLowerCase()),
  );
  const filteredSponsors = sponsors.filter(
    (item) =>
      item.name.toLowerCase().includes(sponsorName.toLowerCase()) &&
      (!sponsorCategory || item.category === sponsorCategory),
  );

  const competitionColumns: Column<PortalRecord>[] = [
    { key: "name", label: "Competition Name", value: (row) => row.name },
    { key: "type", label: "Type", value: (row) => row.type },
    { key: "animal", label: "Animal", value: (row) => row.animal },
    {
      key: "onlinePrice",
      label: "Online Price",
      value: (row) => Number(row.onlinePrice),
      render: (row) => "Rp " + Number(row.onlinePrice).toLocaleString("id-ID"),
    },
  ];

  const sponsorColumns: Column<PortalRecord & { category: string }>[] = [
    {
      key: "logo",
      label: "Brand Logo",
      value: (row) => row.name,
      render: (row) =>
        row.logo ? (
          <Image
            src={row.logo}
            width={32}
            height={32}
            unoptimized
            alt=""
            className="image-preview image-preview-circle"
          />
        ) : (
          <span className="record-initials">{eventInitials(row.name)}</span>
        ),
    },
    { key: "name", label: "Brand Name", value: (row) => row.name },
    {
      key: "category",
      label: "Category",
      value: (row) => row.category,
      render: (row) => <CategoryPill category={row.category} />,
    },
    { key: "phone", label: "Brand Phone", value: (row) => row.phone },
  ];

  return (
    <div className="page-stack">
      <Link className="back-link" href={BASE_PATH}>
        <ArrowLeft size={16} />
        Back to Events
      </Link>
      <section className="form-section pet-detail-card">
        <div className="pet-detail-profile">
          {event.photo ? (
            <Image
              src={event.photo}
              width={72}
              height={72}
              unoptimized
              alt={event.name}
              className="image-preview"
            />
          ) : (
            <span className="image-placeholder" aria-hidden="true">
              {eventInitials(event.name)}
            </span>
          )}
          <div>
            <div className="eyebrow">EVENT DETAILS</div>
            <h2>{event.name}</h2>
            <p className="muted">Organized by {event.organizer || "-"}</p>
            {event.slogan && <p className="muted">{event.slogan}</p>}
          </div>
          <span className="ml-auto">
            <StatusBadge status={event.status} />
          </span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Event ID</dt>
            <dd>{event.id}</dd>
          </div>
          <div>
            <dt>Start Date</dt>
            <dd>{formatDateTime(event.startDate)}</dd>
          </div>
          <div>
            <dt>End Date</dt>
            <dd>{formatDateTime(event.endDate)}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{event.address || "-"}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{event.location || "-"}</dd>
          </div>
        </dl>
      </section>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <h2>Competitions</h2>
            <p className="muted">Competitions configured for the selected event.</p>
          </div>
          <Link className="link-button" href={BASE_PATH + "/" + event.id + "/competitions/create"}>
            <Plus size={15} />
            Add New Competition
          </Link>
        </div>
        <div className="toolbar">
          <Field label="Competition name">
            <Input
              type="search"
              placeholder="Search competition name"
              value={competitionQuery}
              onChange={(evt) => setCompetitionQuery(evt.target.value)}
            />
          </Field>
        </div>
        <DataTable
          rows={filteredCompetitions}
          columns={competitionColumns}
          label="Competitions"
          actions={(item) => (
            <>
              <Link
                aria-label={"View " + item.name}
                title="Competition details"
                href={BASE_PATH + "/" + event.id + "/competitions/" + item.id}
              >
                <Eye size={15} />
              </Link>
              <Link
                aria-label={"Run " + item.name}
                title="Run competition"
                href={"/competition/" + item.id + "/" + runPathFor(item.type)}
              >
                <Play size={15} />
              </Link>
            </>
          )}
        />
      </section>
      <section className="form-section pet-detail-card">
        <div className="section-head">
          <div>
            <h2>Sponsorship and Media Partners</h2>
            <p className="muted">
              Brands assigned to this event. Data is synchronized with Brand
              Details.
            </p>
          </div>
        </div>
        <div className="toolbar">
          <Field label="Brand name">
            <Input
              type="search"
              placeholder="Search brand name"
              value={sponsorName}
              onChange={(evt) => setSponsorName(evt.target.value)}
            />
          </Field>
          <Field label="Category">
            <Select value={sponsorCategory} onChange={(evt) => setSponsorCategory(evt.target.value)}>
              <option value="">All categories</option>
              <option value="Platinum">Platinum</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Bronze">Bronze</option>
              <option value="Media Partner">Media Partner</option>
            </Select>
          </Field>
        </div>
        {sponsors.length === 0 ? (
          <div className="empty-state-cta">
            <span className="empty-state-cta-icon" aria-hidden="true">
              <Handshake size={20} />
            </span>
            <div>
              <strong>No sponsors assigned yet</strong>
              <p className="muted">
                Assign sponsorship and media partners from{" "}
                <Link className="link-button-plain" href="/event-management/partner-registration">
                  Partner Registration
                </Link>
                .
              </p>
            </div>
          </div>
        ) : (
          <DataTable rows={filteredSponsors} columns={sponsorColumns} label="Sponsors and media partners" />
        )}
      </section>
    </div>
  );
}
