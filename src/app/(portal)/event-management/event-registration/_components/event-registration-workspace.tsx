"use client";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/common/page-heading";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { FindEvent } from "../../_components/find-event";
import { RegistrationTable } from "./registration-table";
import type { PortalRecord } from "@/types/portal";

export function EventRegistrationWorkspace() {
  const { data, errors } = usePortalData();
  const [event, setEvent] = useState<PortalRecord | undefined>();

  if (errors.registrations)
    return (
      <section className="page-stack">
        <PageHeading title="Event Registration" />
        <p role="alert" className="form-error">
          {errors.registrations}
        </p>
      </section>
    );

  return (
    <div className="page-stack">
      <PageHeading
        title="Event Registration"
        description="Register pets to a competition and track their entry status."
      />
      {!event ? (
        <FindEvent events={data.events} onSelect={setEvent} />
      ) : (
        <>
          <Button variant="ghost" onClick={() => setEvent(undefined)}>
            <ArrowLeft size={16} />
            Back to event search
          </Button>
          <section className="form-section pet-detail-card">
            <div className="eyebrow">SELECTED EVENT</div>
            <h2>{event.name}</h2>
          </section>
          <RegistrationTable
            event={event}
            pets={data.pets}
            competitions={data.competitions.filter(
              (competition) => competition.eventId === event.id,
            )}
            registrations={data.registrations}
          />
        </>
      )}
    </div>
  );
}
