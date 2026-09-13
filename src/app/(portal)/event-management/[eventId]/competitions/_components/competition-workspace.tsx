"use client";
import Link from "next/link";
import { Flag, Shuffle } from "lucide-react";
import { RecordWorkspace } from "@/components/common/record-workspace";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { FieldDefinition, ViewMode } from "@/types/portal";
export function CompetitionWorkspace({
  eventId,
  mode,
  id,
}: {
  eventId: string;
  mode?: ViewMode;
  id?: string;
}) {
  const { data, save, remove } = usePortalData();
  const fields: FieldDefinition[] = [
    { key: "name", label: "Competition Name", required: true },
    {
      key: "type",
      label: "Competition Type",
      type: "select",
      required: true,
      options: ["Race", "Checkpoint Race", "Contest", "Time Trial"].map(
        (value) => ({ value, label: value }),
      ),
    },
    {
      key: "animal",
      label: "Animal",
      type: "select",
      required: true,
      options: ["Dog", "Cat", "Rabbit", "Hamster"].map((value) => ({
        value,
        label: value,
      })),
    },
    {
      key: "lanes",
      label: "Configured Lanes",
      type: "number",
      min: 1,
      required: true,
    },
    {
      key: "cutoff",
      label: "Cutoff (seconds)",
      type: "number",
      min: 1,
      required: true,
    },
    { key: "checkpoints", label: "Checkpoint Count", type: "number", min: 1 },
    ...["earlyBird", "online", "ots"].flatMap((key) => [
      {
        key: key + "Price",
        label:
          (key === "earlyBird"
            ? "Early Bird"
            : key === "ots"
              ? "On the Spot"
              : "Online") + " Price (IDR)",
        type: "number" as const,
        min: 0,
        required: true,
      },
      {
        key: key + "Open",
        label: key + " Registration Open",
        type: "datetime-local" as const,
      },
      {
        key: key + "Close",
        label: key + " Registration Close",
        type: "datetime-local" as const,
      },
    ]),
  ];
  const competition = data.competitions.find((item) => item.id === id);
  if (!data.events.some((item) => item.id === eventId))
    return <h1>Event not found</h1>;
  return (
    <RecordWorkspace
      key={mode + (id ?? "")}
      title="Competitions"
      singular="Competition"
      basePath={"/event-management/" + eventId + "/competitions"}
      records={data.competitions
        .filter((item) => item.eventId === eventId)
        .map((item) => ({
          ...item,
          ...Object.fromEntries(
            Object.entries(item)
              .filter(([key]) => key.endsWith("Open") || key.endsWith("Close"))
              .map(([key, value]) => [key, value.slice(0, 16)]),
          ),
        }))}
      fields={fields}
      columns={["name", "type", "animal", "onlinePrice"]}
      mode={mode}
      id={id}
      defaults={{
        eventId,
        type: "Race",
        animal: "Dog",
        lanes: "4",
        cutoff: "60",
        earlyBirdPrice: "0",
        onlinePrice: "0",
        otsPrice: "0",
      }}
      onSave={(record) => save("competitions", { ...record, eventId })}
      onRemove={(id) => remove("competitions", id)}
      validate={(record) =>
        data.competitions.some(
          (item) =>
            item.id !== record.id &&
            item.eventId === eventId &&
            item.name.toLowerCase() === record.name.toLowerCase(),
        )
          ? "This event already has a competition with this name."
          : ["earlyBird", "online", "ots"].some(
                (key) =>
                  record[key + "Open"] &&
                  record[key + "Close"] &&
                  record[key + "Open"] >= record[key + "Close"],
              )
            ? "Registration close must be after registration open."
            : undefined
      }
      canRemove={(record) =>
        data.registrations.some((row) => row.competitionId === record.id)
          ? "This competition has registered participants."
          : undefined
      }
    >
      <div className="form-actions">
        <Link
          className="link-button secondary"
          href={"/competition/" + id + "/drawing"}
        >
          <Shuffle size={16} />
          Drawing
        </Link>
        <Link
          className="link-button"
          href={
            "/competition/" +
            id +
            "/" +
            (competition?.type === "Contest"
              ? "contest"
              : competition?.type === "Time Trial"
                ? "time-trial"
                : "run-match")
          }
        >
          <Flag size={16} />
          Run Competition
        </Link>
      </div>
    </RecordWorkspace>
  );
}
