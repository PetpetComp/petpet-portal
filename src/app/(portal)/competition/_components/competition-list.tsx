"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Eye,
  Flag,
  ArrowRight,
  Plus,
  Trophy,
  CalendarDays,
  Users,
  CircleCheck,
} from "lucide-react";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { PageHeading } from "@/components/common/page-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import { Field, Input, Select } from "@/components/ui/form-controls";

export function CompetitionList() {
  const { data } = usePortalData();
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState("");
  const [type, setType] = useState("");
  const rows = data.competitions.filter(
    (item) =>
      (!eventId || item.eventId === eventId) &&
      (!type || item.competitionTypeId === type) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="page-stack competition-overview">
      <PageHeading
        title="Competition"
        description="Manage competitions, registration periods, rules, and scoring criteria."
        actions={
          <Link href="/event-management" className="link-button">
            <Plus size={16} />
            Manage events
          </Link>
        }
      />
      <div className="stats-grid">
        <div className="stat">
          <span className="stat-label">
            Total Competitions
            <Trophy size={19} aria-hidden="true" />
          </span>
          <strong>{data.competitions.length}</strong>
        </div>
        <div className="stat">
          <span className="stat-label">
            Active Events
            <CalendarDays size={19} aria-hidden="true" />
          </span>
          <strong>
            {data.events.filter((item) => item.status !== "Closed").length}
          </strong>
        </div>
        <div className="stat">
          <span className="stat-label">
            Checked-in Entries
            <Users size={19} aria-hidden="true" />
          </span>
          <strong>
            {
              data.registrations.filter(
                (item) => item.checkinStatus === "Checked In",
              ).length
            }
          </strong>
        </div>
        <div className="stat">
          <span className="stat-label">
            Registration Closed
            <CircleCheck size={19} aria-hidden="true" />
          </span>
          <strong>
            {
              data.competitions.filter((item) => item.raceStatus === "Closed")
                .length
            }
          </strong>
        </div>
      </div>
      <section
        className="competition-directory"
        aria-labelledby="competition-directory-title"
      >
        <div className="section-head">
          <div>
            <h2 id="competition-directory-title">Competition directory</h2>
            <p>Find a competition and manage its settings.</p>
          </div>
          <span className="directory-count" role="status">
            {rows.length} competitions
          </span>
        </div>
        <div className="toolbar">
          <Field label="Competition">
            <Input
              type="search"
              placeholder="Search competition"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <Field label="Event">
            <Select
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
            >
              <option value="">All Events</option>
              {data.events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="">All Types</option>
              {Array.from(
                new Set(
                  data.competitions
                    .map((item) => item.competitionTypeId)
                    .filter(Boolean),
                ),
              ).map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
          {(query || eventId || type) && (
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setEventId("");
                setType("");
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
        <DataTable
          label="Competitions"
          rows={rows}
          columns={[
            {
              key: "name",
              label: "Competition",
              value: (row) => row.name,
              render: (row) => (
                <div className="record-name">
                  <span className="record-initials">
                    <Flag size={18} />
                  </span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.id}</small>
                  </div>
                </div>
              ),
            },
            {
              key: "event",
              label: "Event",
              value: (row) =>
                data.events.find((event) => event.id === row.eventId)?.name ??
                "-",
            },
            {
              key: "type",
              label: "Type ID",
              value: (row) => row.competitionTypeId || "-",
            },
            {
              key: "animal",
              label: "Species ID",
              value: (row) => row.speciesId || "-",
            },
            {
              key: "result",
              label: "Status",
              value: (row) => row.status || "-",
              render: (row) => <StatusBadge status={row.status || "-"} />,
            },
          ]}
          actions={(row) => (
            <>
              <Link
                href={
                  "/event-management/" + row.eventId + "/competitions/" + row.id
                }
                title="View details"
                aria-label={"View " + row.name}
              >
                <Eye size={15} />
              </Link>
            </>
          )}
        />
      </section>
      {data.competitions[0] && (
        <Link
          href={
            "/event-management/" +
            data.competitions[0].eventId +
            "/competitions/" +
            data.competitions[0].id
          }
          className="resume-competition"
        >
          <span className="resume-icon">
            <Flag size={24} />
          </span>
          <div>
            <span className="eyebrow">COMPETITION SETTINGS</span>
            <h2>{data.competitions[0].name}</h2>
            <p>
              View the schedule, registration periods, and rules for this
              competition.
            </p>
          </div>
          <span className="link-button">
            Manage Competition
            <ArrowRight size={15} />
          </span>
        </Link>
      )}
    </div>
  );
}
