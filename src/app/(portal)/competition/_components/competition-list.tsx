"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, Flag, ArrowRight, Shuffle } from "lucide-react";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { COMPETITION_TYPES, runPathFor } from "@/app/(portal)/event-management/[eventId]/competitions/_lib/competition-rules";
export function CompetitionList() {
  const { data } = usePortalData();
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState("");
  const [type, setType] = useState("");
  const rows = data.competitions.filter(
    (item) =>
      (!eventId || item.eventId === eventId) &&
      (!type || item.type === type) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="page-stack">
      <PageHeading title="Competition" />
      <div className="stats-grid">
        <div className="stat">
          <span>Total Competitions</span>
          <strong>{data.competitions.length}</strong>
        </div>
        <div className="stat">
          <span>Active Events</span>
          <strong>
            {data.events.filter((item) => item.status !== "Closed").length}
          </strong>
        </div>
        <div className="stat">
          <span>Verified Participants</span>
          <strong>
            {
              data.registrations.filter(
                (item) => item.paymentStatus === "Verified",
              ).length
            }
          </strong>
        </div>
        <div className="stat">
          <span>Results Saved</span>
          <strong>
            {
              data.competitions.filter((item) => item.resultStatus === "Saved")
                .length
            }
          </strong>
        </div>
      </div>
      <section>
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
              {COMPETITION_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
        </div>
        <DataTable
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
            { key: "type", label: "Type", value: (row) => row.type },
            { key: "animal", label: "Animal", value: (row) => row.animal },
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
              <Link
                href={"/competition/" + row.id + "/drawing"}
                title="Drawing"
                aria-label={"Drawing " + row.name}
              >
                <Shuffle size={15} />
              </Link>
              <Link
                href={"/competition/" + row.id + "/" + runPathFor(row.type)}
                title="Run competition"
                aria-label={"Run " + row.name}
              >
                <Flag size={15} />
              </Link>
            </>
          )}
        />
      </section>
      {data.competitions[0] && (
        <Link
          href={
            "/competition/" +
            data.competitions[0].id +
            "/" +
            runPathFor(data.competitions[0].type)
          }
          className="resume-competition"
        >
          <span className="resume-icon">
            <Flag size={24} />
          </span>
          <div>
            <span className="eyebrow">RACE CONTROL</span>
            <h2>{data.competitions[0].name}</h2>
            <p>Round 1 / Heat 1</p>
          </div>
          <span className="link-button">
            Open Race Controller
            <ArrowRight size={15} />
          </span>
        </Link>
      )}
    </div>
  );
}
