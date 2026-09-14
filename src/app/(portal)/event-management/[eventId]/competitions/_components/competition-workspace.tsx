"use client";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeading } from "@/components/common/page-heading";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { ViewMode } from "@/types/portal";
import { CompetitionList } from "./competition-list";
import { CompetitionForm } from "./competition-form";
import { CompetitionDetail } from "./competition-detail";

const CURRENT_ACTOR = "Admin Petpet";

export function CompetitionWorkspace({
  eventId,
  mode = "list",
  id,
}: {
  eventId: string;
  mode?: ViewMode;
  id?: string;
}) {
  const { data, save, remove } = usePortalData();
  const event = data.events.find((item) => item.id === eventId);
  const competition = id ? data.competitions.find((item) => item.id === id) : undefined;
  const competitions = data.competitions.filter((item) => item.eventId === eventId);

  if (!event) {
    return (
      <div className="page-stack">
        <PageHeading title="Event not found" />
        <Link className="back-link" href="/event-management">
          Back to Events
        </Link>
      </div>
    );
  }
  if ((mode === "detail" || mode === "edit") && !competition) {
    return (
      <div className="page-stack">
        <PageHeading title="Competition not found" />
        <Link className="back-link" href={"/event-management/" + eventId}>
          Back to Event Details
        </Link>
      </div>
    );
  }

  return (
    <>
      {mode === "list" && <CompetitionList event={event} competitions={competitions} />}
      {mode === "create" && (
        <CompetitionForm
          mode="create"
          event={event}
          competitions={competitions}
          onSave={(record) => save("competitions", record)}
        />
      )}
      {mode === "edit" && competition && (
        <CompetitionForm
          mode="edit"
          event={event}
          competition={competition}
          competitions={competitions}
          onSave={(record) => save("competitions", record)}
        />
      )}
      {mode === "detail" && competition && (
        <CompetitionDetail
          event={event}
          competition={competition}
          users={data.users}
          committee={data.committee.filter((row) => row.competitionId === competition.id)}
          participants={data.registrations
            .filter((row) => row.competitionId === competition.id)
            .map((row) => {
              const pet = data.pets.find((item) => item.id === row.petId);
              const user = data.users.find((item) => item.id === row.userId);
              return {
                ...row,
                ownerName: user?.name ?? "-",
                petName: pet?.name ?? "-",
                animal: pet?.animal ?? "-",
                variant: pet?.variant ?? "-",
                phone: user?.phone ?? "-",
                paymentStatus: row.paymentStatus,
              };
            })}
          onAddCommittee={(member) => save("committee", member)}
          onRemoveCommittee={(committeeId) => remove("committee", committeeId)}
          onCloseRegistration={() => {
            save("competitions", {
              ...competition,
              registrationStatus: "Closed",
              registrationClosedDate: new Date().toISOString(),
              registrationClosedBy: CURRENT_ACTOR,
            });
            toast.success("Registration closed");
          }}
        />
      )}
    </>
  );
}
