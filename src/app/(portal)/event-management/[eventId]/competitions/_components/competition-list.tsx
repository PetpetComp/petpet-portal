"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { Field, Input } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import type { PortalRecord } from "@/types/portal";
import { EventInfoCard } from "@/app/(portal)/event-management/_components/event-info-card";

export function CompetitionList({
  event,
  competitions,
}: {
  event: PortalRecord;
  competitions: PortalRecord[];
}) {
  const [name, setName] = useState("");
  const filtered = competitions.filter((item) =>
    item.name.toLowerCase().includes(name.toLowerCase()),
  );
  const basePath = "/event-management/" + event.id + "/competitions";
  const columns: Column<PortalRecord>[] = [
    { key: "name", label: "Competition Name", value: (row) => row.name },
    { key: "type", label: "Type", value: (row) => row.type },
    { key: "animal", label: "Animal", value: (row) => row.animal },
    {
      key: "onlinePrice",
      label: "Online Price",
      value: (row) => Number(row.onlinePrice),
      render: (row) => "Rp " + Number(row.onlinePrice || 0).toLocaleString("id-ID"),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeading
        title="Competitions"
        description={"Competitions configured for " + event.name + "."}
        actions={
          <Link href={basePath + "/create"} className="link-button">
            <Plus size={16} />
            Add New Competition
          </Link>
        }
      />
      <EventInfoCard event={event} />
      <section>
        <div className="toolbar">
          <Field label="Competition name">
            <Input
              type="search"
              placeholder="Search competition name"
              value={name}
              onChange={(evt) => setName(evt.target.value)}
            />
          </Field>
        </div>
        <DataTable
          rows={filtered}
          columns={columns}
          label="Competitions"
          actions={(item) => (
            <>
              <Link href={basePath + "/" + item.id} title={"View " + item.name}>
                <Eye size={15} />
              </Link>
              <Link href={basePath + "/" + item.id + "/edit"} title={"Edit " + item.name}>
                <Pencil size={14} />
              </Link>
            </>
          )}
        />
      </section>
    </div>
  );
}
