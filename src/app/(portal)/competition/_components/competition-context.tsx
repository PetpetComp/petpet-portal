"use client";
import Link from "next/link";
import { CalendarDays, MapPin, Flag, ArrowLeft } from "lucide-react";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
export function CompetitionContext({
  competition,
  active,
}: {
  competition: PortalRecord;
  active: string;
}) {
  const { data } = usePortalData();
  const event = data.events.find((item) => item.id === competition.eventId);
  return (
    <>
      <div className="event-banner">
        <div className="event-banner-main">
          <span className="event-mark">
            <Flag size={27} />
          </span>
          <div>
            <span className="eyebrow">COMPETITION OPERATIONS</span>
            <h2>{event?.name ?? "Event"}</h2>
            <div className="event-meta">
              <span>
                <MapPin size={12} />
                {event?.location}
              </span>
              <span>
                <CalendarDays size={12} />
                {event?.startDate.slice(0, 10)}
              </span>
            </div>
          </div>
        </div>
        <div className="organizer">
          <span>ORGANIZED BY</span>
          <strong>{event?.organizer}</strong>
        </div>
      </div>
      <div className="competition-navigation">
        <Link href="/competition" className="back-link">
          <ArrowLeft size={14} />
          All Competitions
        </Link>
        <nav className="tabs" aria-label="Competition views">
          {[
            ["drawing", "Drawing"],
            [
              competition.type === "Contest"
                ? "contest"
                : competition.type === "Time Trial"
                  ? "time-trial"
                  : "run-match",
              competition.type === "Contest"
                ? "Judging"
                : competition.type === "Time Trial"
                  ? "Time Trial"
                  : "Run Match",
            ],
          ].map(([path, label]) => (
            <Link
              className={active === path ? "active" : ""}
              key={path}
              href={"/competition/" + competition.id + "/" + path}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
