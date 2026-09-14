"use client";
import { useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { EventInfoCard } from "@/app/(portal)/event-management/_components/event-info-card";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
import { FindEvent } from "@/app/(portal)/event-management/_components/find-event";
import { PartnerSponsorSection } from "./partner-sponsor-section";

export function PartnerRegistrationWorkspace() {
  const { data, save, remove } = usePortalData();
  const [selectedEventId, setSelectedEventId] = useState("");
  const event = data.events.find((item) => item.id === selectedEventId);

  return (
    <div className="page-stack">
      <PageHeading
        title="Partner Registration"
        description="Select an eligible event first, then manage sponsorship and media partner registration for that event."
      />
      <FindEvent events={data.events} onSelect={(item: PortalRecord) => setSelectedEventId(item.id)} />
      {event && (
        <>
          <EventInfoCard event={event} />
          <PartnerSponsorSection
            event={event}
            brands={data.brands}
            assignments={data.partners.filter((row) => row.eventId === event.id)}
            onAdd={(assignment) => save("partners", assignment)}
            onUpdateCategory={(id, category) => {
              const current = data.partners.find((row) => row.id === id);
              if (current) save("partners", { ...current, category });
            }}
            onRemove={(id) => remove("partners", id)}
          />
        </>
      )}
    </div>
  );
}
