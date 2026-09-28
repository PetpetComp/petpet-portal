"use client";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable } from "@/components/common/data-table";
import { useAuth } from "@/hooks/use-auth";
import { EVENT_SERVICES } from "@/services/event-management";
import { COMPETITION_SERVICES } from "@/services/competition";
import { ENTRY_SERVICES } from "@/services/event-operations";
import { collectRows } from "@/services/common";
import type { Row } from "@/services/backend-records";

type IdRow = Row & { id: string };
const withId = (row: Row): IdRow => ({ ...row, id: String(row.uuid) });

export function CompetitorHome() {
  const { user } = useAuth();
  const [events, setEvents] = useState<IdRow[]>([]);
  const [entries, setEntries] = useState<IdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const loadedEvents = await collectRows(EVENT_SERVICES.list);
        const competitionsByEvent = await Promise.all(
          loadedEvents.map((event) =>
            collectRows((params) => COMPETITION_SERVICES.list(String(event.uuid), params)),
          ),
        );
        const competitions = competitionsByEvent.flat();
        const entriesByCompetition = await Promise.all(
          competitions.map((competition) =>
            collectRows((params) => ENTRY_SERVICES.list(String(competition.uuid), params)),
          ),
        );
        const myEntries = entriesByCompetition
          .flat()
          .filter((entry) => entry.owner_uuid === user?.id);
        if (active) {
          setEvents(loadedEvents.map(withId));
          setEntries(myEntries.map(withId));
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load competitions.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading) return <p role="status">Loading competitions...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <div className="page-stack">
      <PageHeading title="Cari Event & Kompetisi" description="Kompetisi yang sedang dibuka." />
      <DataTable
        label="Events"
        rows={events}
        columns={[
          { key: "name", label: "Event", value: (row) => String(row.name ?? "") },
          { key: "start_at", label: "Mulai", value: (row) => String(row.start_at ?? "") },
          { key: "status", label: "Status", value: (row) => String(row.status ?? "") },
        ]}
      />
      <PageHeading title="Entry Saya" />
      <DataTable
        label="Entries"
        rows={entries}
        columns={[
          { key: "bib_number", label: "Bib", value: (row) => String(row.bib_number ?? "-") },
          { key: "payment_status", label: "Pembayaran", value: (row) => String(row.payment_status ?? "") },
          { key: "status", label: "Status", value: (row) => String(row.status ?? "") },
        ]}
      />
    </div>
  );
}
