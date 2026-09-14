"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord, ViewMode } from "@/types/portal";
import { EventList } from "./event-list";
import { EventWizard } from "./event-wizard";
import { EventSetup } from "./event-setup";
import { hasLinkedRecords } from "../_lib/event-rules";

export function EventWorkspace({ mode = "list", id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const [deleting, setDeleting] = useState<PortalRecord | null>(null);
  const event = id ? data.events.find((item) => item.id === id) : undefined;

  function requestDelete(record: PortalRecord) {
    if (hasLinkedRecords(data, record.id)) {
      toast.error(
        "This event still has competitions, registrations, or partners. Remove its related records first.",
      );
      return;
    }
    setDeleting(record);
  }

  if ((mode === "detail" || mode === "edit") && !event) {
    return (
      <div className="page-stack">
        <PageHeading title="Event not found" />
        <Link className="back-link" href="/event-management">
          <ArrowLeft size={16} />
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <>
      {mode === "list" && (
        <EventList events={data.events} onRequestDelete={requestDelete} />
      )}
      {mode === "create" && (
        <EventWizard
          mode="create"
          events={data.events}
          brands={data.brands}
          users={data.users}
          onSaveEvent={(record) => save("events", record)}
          onCreateBrand={(brand) => save("brands", brand)}
          onCreateUser={(user) => save("users", user)}
          onAssignCommittee={(committee) => save("committee", committee)}
        />
      )}
      {mode === "edit" && event && (
        <EventWizard
          mode="edit"
          event={event}
          events={data.events}
          brands={data.brands}
          users={data.users}
          onSaveEvent={(record) => save("events", record)}
          onCreateBrand={(brand) => save("brands", brand)}
          onCreateUser={(user) => save("users", user)}
          onAssignCommittee={(committee) => save("committee", committee)}
        />
      )}
      {mode === "detail" && event && (
        <EventSetup
          event={event}
          competitions={data.competitions.filter((item) => item.eventId === event.id)}
          sponsors={data.partners
            .filter((item) => item.eventId === event.id)
            .map((item) => {
              const brand = data.brands.find((row) => row.id === item.sponsorId);
              return {
                ...(brand ?? { id: item.sponsorId, name: "Unknown brand", phone: "-" }),
                category: item.category,
              };
            })}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={"Delete " + (deleting?.name ?? "event") + "?"}
        description={
          deleting ? deleting.name + " will be removed from this session." : ""
        }
        onConfirm={() => {
          if (deleting) {
            remove("events", deleting.id);
            toast.success("Event deleted");
          }
        }}
      />
    </>
  );
}
