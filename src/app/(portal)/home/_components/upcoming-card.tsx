"use client";
import Link from "next/link";
import { SectionCard } from "@/components/common/page-layout";
import type { Event } from "@/domains/events/types";
import { ROUTES } from "@/lib/constants/routes";
import { daysUntilLabel } from "../_lib/home";
import { HOME_TEXT } from "../_lib/home-text";

/**
 * Kartu "Coming up": beberapa event berikutnya (tanggal, nama, tempat, jarak hari) dan link
 * ke daftar Events. Dipanggil dari `organizer-home.tsx`. `events` sudah terurut dan dibatasi.
 */
export function UpcomingCard({ events }: { events: Event[] }) {
  const now = new Date();
  return (
    <SectionCard title={HOME_TEXT.comingUp}>
      {events.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {HOME_TEXT.nothingScheduled}
        </p>
      )}
      <ul className="grid min-w-0 gap-2">
        {events.map((event) => {
          const start = new Date(event.startAt);
          const venue = event.venueName || "Venue to be announced";
          return (
            <li key={event.id} className="min-w-0">
              <Link
                href={ROUTES.eventManagement.detail(event.id)}
                className="hover:bg-muted flex min-w-0 items-center gap-3 rounded-xl p-2"
              >
                <span className="bg-primary-soft text-primary-dark grid w-12 shrink-0 justify-items-center rounded-xl py-1.5">
                  <b className="font-mono text-lg leading-none">
                    {start.getDate()}
                  </b>
                  <span className="text-[11px] font-bold uppercase">
                    {start.toLocaleString("en-GB", { month: "short" })}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{event.name}</b>
                  <span className="text-muted-foreground block truncate text-sm">
                    {venue} - {daysUntilLabel(event.startAt, now)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={ROUTES.eventManagement.root}
        className="text-primary-dark text-sm font-semibold"
      >
        {HOME_TEXT.allEvents}
      </Link>
    </SectionCard>
  );
}
