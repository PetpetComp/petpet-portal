"use client";
import Link from "next/link";
import { ErrorState } from "@/components/common/error-state";
import { SectionCard } from "@/components/common/page-layout";
import { StatusBadge } from "@/components/common/status-badge";
import { useEventCompetitions } from "@/domains/competitions/queries";
import { COMPETITION_STATUS_LABEL } from "@/domains/competitions/types";
import type { Event } from "@/domains/events/types";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";
import { HOME_TEXT } from "../_lib/home-text";
import { LiveNowCard } from "./live-now-card";

/**
 * Satu event yang berlangsung hari ini: kartu "Live now" untuk tiap kompetisi ONGOING (link
 * ke Live Mode) dan daftar semua kompetisinya. Dipanggil dari `organizer-home.tsx`.
 */
export function TodayEvent({ event }: { event: Event }) {
  const competitions = useEventCompetitions(event.id);
  const rows = competitions.data ?? [];
  const live = rows.filter((c) => c.status === "ONGOING");

  return (
    <section aria-label={event.name} className="grid min-w-0 gap-5">
      {live.map((competition) => (
        <LiveNowCard
          key={competition.id}
          competition={competition}
          eventName={event.name}
        />
      ))}

      <SectionCard
        title={HOME_TEXT.todaysCompetitions}
        description={event.name}
        action={
          <Link
            href={ROUTES.eventManagement.detail(event.id)}
            className="text-primary-dark text-sm font-semibold"
          >
            {HOME_TEXT.openEvent}
          </Link>
        }
      >
        {competitions.isPending && (
          <p className="text-muted-foreground text-sm">{HOME_TEXT.loading}</p>
        )}
        {competitions.isError && (
          <ErrorState
            error={competitions.error}
            onRetry={() => void competitions.refetch()}
          />
        )}
        {competitions.isSuccess && rows.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {HOME_TEXT.noCompetitions}
          </p>
        )}
        <ul className="divide-border grid min-w-0 divide-y">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="min-w-0">
                <b className="block truncate">{c.name}</b>
                <span className="text-muted-foreground text-sm">
                  {formatDateTime(c.startAt)}
                </span>
              </span>
              <StatusBadge status={COMPETITION_STATUS_LABEL[c.status]} />
            </li>
          ))}
        </ul>
      </SectionCard>
    </section>
  );
}
