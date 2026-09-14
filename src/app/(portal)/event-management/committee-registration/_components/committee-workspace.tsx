"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord, ViewMode } from "@/types/portal";
import { CommitteeList } from "./committee-list";
import { CommitteeForm } from "./committee-form";
import { CommitteeDetail } from "./committee-detail";

export function CommitteeWorkspace({ mode = "list", id }: { mode?: ViewMode; id?: string }) {
  const { data, save, remove } = usePortalData();
  const [deleting, setDeleting] = useState<PortalRecord | null>(null);
  const record = id ? data.committee.find((item) => item.id === id) : undefined;

  if ((mode === "detail" || mode === "edit") && !record) {
    return (
      <div className="page-stack">
        <PageHeading title="Committee assignment not found" />
        <Link className="back-link" href="/event-management/committee-registration">
          Back to Committee Registration
        </Link>
      </div>
    );
  }

  return (
    <>
      {mode === "list" && (
        <CommitteeList
          committee={data.committee}
          users={data.users}
          events={data.events}
          competitions={data.competitions}
          onRequestDelete={setDeleting}
        />
      )}
      {mode === "create" && (
        <CommitteeForm
          mode="create"
          committee={data.committee}
          users={data.users}
          events={data.events}
          competitions={data.competitions}
          onSave={(next) => save("committee", next)}
        />
      )}
      {mode === "edit" && record && (
        <CommitteeForm
          mode="edit"
          record={record}
          committee={data.committee}
          users={data.users}
          events={data.events}
          competitions={data.competitions}
          onSave={(next) => save("committee", next)}
        />
      )}
      {mode === "detail" && record && (
        <CommitteeDetail
          record={record}
          user={data.users.find((user) => user.id === record.userId)}
          event={data.events.find((event) => event.id === record.eventId)}
          competition={data.competitions.find((item) => item.id === record.competitionId)}
          onRequestDelete={() => setDeleting(record)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove this committee assignment?"
        description={
          deleting
            ? (data.users.find((user) => user.id === deleting.userId)?.name ?? deleting.userId) +
              " will be removed from this assignment."
            : ""
        }
        onConfirm={() => {
          if (deleting) {
            remove("committee", deleting.id);
            toast.success("Committee assignment removed");
          }
        }}
      />
    </>
  );
}
