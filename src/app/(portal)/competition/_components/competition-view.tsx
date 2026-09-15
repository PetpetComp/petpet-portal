"use client";
import { usePortalData } from "@/components/providers/portal-data-provider";
import Link from "next/link";
export function CompetitionView({ id, view }: { id: string; view: string }) {
  const { data } = usePortalData();
  const competition = data.competitions.find((item) => item.id === id);
  return (
    <section className="page-stack">
      <h1>{competition?.name ?? "Competition not found"}</h1>
      <p>
        {view === "drawing" ? "Drawing" : "Race controls"} will be available
        when the competition results service is connected.
      </p>
      {competition && (
        <Link
          className="link-button"
          href={
            "/event-management/" +
            competition.eventId +
            "/competitions/" +
            competition.id
          }
        >
          Manage competition settings
        </Link>
      )}
      <Link href="/competition">Back to competitions</Link>
    </section>
  );
}
