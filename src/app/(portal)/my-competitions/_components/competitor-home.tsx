"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Flag, MapPin, PartyPopper, PawPrint, Ticket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PageHero } from "@/components/common/page-hero";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { EVENT_SERVICES } from "@/services/event-management";
import { COMPETITION_SERVICES } from "@/services/competition";
import { ENTRY_SERVICES } from "@/services/event-operations";
import { collectRows } from "@/services/common";
import { formatDate } from "@/lib/format/date";
import { ROUTES } from "@/lib/constants/routes";
import type { Row } from "@/services/backend-records";
import "./my-competitions.css";

export function CompetitorHome() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Row[]>([]);
  const [competitions, setCompetitions] = useState<Row[]>([]);
  const [entries, setEntries] = useState<Row[]>([]);
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
        const loadedCompetitions = competitionsByEvent.flat();
        const entriesByCompetition = await Promise.all(
          loadedCompetitions.map((competition) =>
            collectRows((params) => ENTRY_SERVICES.list(String(competition.uuid), params)),
          ),
        );
        const myEntries = entriesByCompetition
          .flat()
          .filter((entry) => entry.owner_uuid === user?.id);
        if (active) {
          setEvents(loadedEvents);
          setCompetitions(loadedCompetitions);
          setEntries(myEntries);
        }
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to load competitions.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading)
    return (
      <div className="competitor-loading">
        <PawPrint size={22} className="competitor-loading-icon" aria-hidden="true" />
        <p role="status">Nyari kompetisi buat kamu...</p>
      </div>
    );
  if (error) return <p role="alert">{error}</p>;

  const firstName = user?.name?.split(" ")[0] ?? "Juara";

  return (
    <div className="competitor-home">
      <PageHero
        eyebrow={`Halo, ${firstName}!`}
        title="Yuk cari kompetisi buat si kesayangan 🐾"
        description="Ini event yang lagi buka pendaftaran dan riwayat entry kamu."
      />

      <section aria-label="Event yang sedang dibuka">
        <h2 className="competitor-section-title">Event yang sedang dibuka</h2>
        {events.length === 0 ? (
          <EmptyState icon={PartyPopper} message="Belum ada event yang dibuka. Balik lagi nanti ya!" />
        ) : (
          <div className="competitor-event-grid">
            {events.map((event) => {
              const eventCompetitions = competitions.filter(
                (competition) => competition.event_uuid === event.uuid,
              );
              return (
                <article key={String(event.uuid)} className="competitor-event-card">
                  <StatusBadge status={String(event.status ?? "Open")} />
                  <h3>{String(event.name ?? "")}</h3>
                  <span className="competitor-meta">
                    <CalendarDays size={14} aria-hidden="true" />
                    {event.start_at ? formatDate(String(event.start_at)) : "-"}
                  </span>
                  {event.venue_name ? (
                    <span className="competitor-meta">
                      <MapPin size={14} aria-hidden="true" />
                      {String(event.venue_name)}
                    </span>
                  ) : null}
                  <span className="competitor-meta">
                    <Flag size={14} aria-hidden="true" />
                    {eventCompetitions.length} kompetisi
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Entry saya">
        <h2 className="competitor-section-title">Entry Saya</h2>
        {entries.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            message="Kamu belum daftarin pet ke kompetisi manapun."
            action={{
              label: (
                <>
                  Daftarkan pet pertamamu <Ticket size={15} aria-hidden="true" />
                </>
              ),
              href: ROUTES.pets.create,
            }}
          />
        ) : (
          <div className="competitor-entry-grid">
            {entries.map((entry) => {
              const competition = competitions.find(
                (item) => item.uuid === entry.competition_uuid,
              );
              return (
                <article key={String(entry.uuid)} className="competitor-entry-card">
                  <span className="competitor-entry-icon">
                    <PawPrint size={18} aria-hidden="true" />
                  </span>
                  <div className="competitor-entry-body">
                    <h3>{String(competition?.name ?? "Kompetisi")}</h3>
                    <span className="competitor-meta">
                      <Ticket size={13} aria-hidden="true" />
                      Bib {String(entry.bib_number ?? "-")}
                    </span>
                  </div>
                  <div className="competitor-entry-tags">
                    <StatusBadge status={String(entry.payment_status ?? "-")} />
                    <StatusBadge status={String(entry.status ?? "-")} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
