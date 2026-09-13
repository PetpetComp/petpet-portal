"use client";
import Link from "next/link";
import { Plus, Eye, Play } from "lucide-react";
import { RecordWorkspace } from "@/components/common/record-workspace";
import { DataTable } from "@/components/common/data-table";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { FieldDefinition, ViewMode } from "@/types/portal";
const fields: FieldDefinition[] = [
  { key: "photo", label: "Event Photo", type: "image" },
  { key: "name", label: "Event Name", required: true },
  { key: "organizer", label: "Organizer", required: true },
  {
    key: "startDate",
    label: "Start Date",
    type: "datetime-local",
    required: true,
  },
  { key: "endDate", label: "End Date", type: "datetime-local", required: true },
  { key: "location", label: "Location", required: true },
  { key: "address", label: "Address", type: "textarea", required: true },
  { key: "locationUrl", label: "Location URL" },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: ["Pending", "Open", "Closed"].map((value) => ({
      value,
      label: value,
    })),
  },
];
export function EventWorkspace({ mode, id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const records = data.events.map((event) => ({
    ...event,
    startDate: event.startDate.slice(0, 16),
    endDate: event.endDate.slice(0, 16),
  }));
  return (
    <RecordWorkspace
      key={mode + (id ?? "")}
      title="Event Management"
      singular="Event"
      basePath="/event-management"
      records={records}
      fields={fields}
      columns={[
        "name",
        "startDate",
        "endDate",
        "location",
        "organizer",
        "status",
      ]}
      mode={mode}
      id={id}
      defaults={{ status: "Pending" }}
      onSave={(record) => save("events", record)}
      onRemove={(id) => remove("events", id)}
      validate={(record) =>
        record.endDate <= record.startDate
          ? "End date must be after the start date."
          : undefined
      }
      canRemove={(record) =>
        [
          ...data.competitions,
          ...data.registrations,
          ...data.committee,
          ...data.partners,
          ...data.prizes,
        ].some((item) => item.eventId === record.id)
          ? "This event still has competitions, registrations, or partners. Remove its related records first."
          : undefined
      }
    >
      <section className="form-section">
        <div className="section-head">
          <h2>Competitions</h2>
          <Link
            className="link-button"
            href={"/event-management/" + id + "/competitions/create"}
          >
            <Plus size={15} />
            Add Competition
          </Link>
        </div>
        <DataTable
          rows={data.competitions.filter((item) => item.eventId === id)}
          columns={[
            { key: "name", label: "Competition", value: (row) => row.name },
            { key: "type", label: "Type", value: (row) => row.type },
            { key: "animal", label: "Animal", value: (row) => row.animal },
            {
              key: "onlinePrice",
              label: "Online Price",
              value: (row) => Number(row.onlinePrice),
              render: (row) =>
                "Rp " + Number(row.onlinePrice).toLocaleString("id-ID"),
            },
          ]}
          actions={(item) => (
            <>
              <Link
                aria-label={"View " + item.name}
                title="Competition details"
                href={"/event-management/" + id + "/competitions/" + item.id}
              >
                <Eye size={15} />
              </Link>
              <Link
                aria-label={"Run " + item.name}
                title="Run competition"
                href={
                  "/competition/" +
                  item.id +
                  "/" +
                  (item.type === "Contest"
                    ? "contest"
                    : item.type === "Time Trial"
                      ? "time-trial"
                      : "run-match")
                }
              >
                <Play size={15} />
              </Link>
            </>
          )}
        />
      </section>
    </RecordWorkspace>
  );
}
