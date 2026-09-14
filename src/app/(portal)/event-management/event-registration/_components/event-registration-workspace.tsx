"use client";
import { useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { EventInfoCard } from "@/app/(portal)/event-management/_components/event-info-card";
import { FindEvent } from "@/app/(portal)/event-management/_components/find-event";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { ParticipantSection } from "./participant-section";
import { RegistrationTable } from "./registration-table";

export function EventRegistrationWorkspace() {
  const { data, save } = usePortalData();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const event = data.events.find((item) => item.id === selectedEventId);
  const user = data.users.find((item) => item.id === selectedUserId);

  return (
    <div className="page-stack">
      <PageHeading
        title="Event Registration"
        description="Find an event and participant, review current registrations, and register additional pets."
      />
      <FindEvent
        events={data.events}
        eyebrow="STEP 1"
        onSelect={(item) => {
          setSelectedEventId(item.id);
          setSelectedUserId("");
        }}
      />
      {event && (
        <>
          <EventInfoCard event={event} />
          <ParticipantSection
            users={data.users}
            participant={user}
            onSelect={setSelectedUserId}
          />
          {user && (
            <RegistrationTable
              event={event}
              user={user}
              pets={data.pets}
              competitions={data.competitions.filter((item) => item.eventId === event.id)}
              registrations={data.registrations}
              onSave={(registration) => save("registrations", registration)}
            />
          )}
        </>
      )}
    </div>
  );
}
