"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, Inbox } from "lucide-react";
import { useEventCompetitions } from "@/domains/competitions/queries";
import { useHomeEvents } from "@/domains/events/queries";
import { eventsByDay, relevantEvents } from "@/domains/events/schedule";
import type { Event } from "@/domains/events/types";
import {
  useOrganizationsCount,
  usePendingApplicationsCount,
} from "@/domains/organizations/queries";
import { useUsersCount } from "@/domains/users/queries";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";

const ROLE_LABEL: Record<string, string> = {
  EVENT_MANAGER: "Event manager",
  COMPETITION_PIC: "Competition PIC",
  TIMER_OPERATOR: "Timer",
  MARSHAL: "Marshal",
  JUDGE: "Judge",
  HEAD_JUDGE: "Head judge",
};

const today = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * One Home for everyone; each block shows only to people it concerns, so a
 * user with several roles (organizer who also judges elsewhere) sees all of them.
 */
export function HomePage() {
  const { user, can, assignments, memberships } = useAuth();
  const isAdmin = can(PERMISSION.ORGANIZATION_VERIFY);
  const isOrganizer = can(PERMISSION.EVENT_UPDATE);
  const hasAssignments = assignments.length > 0;

  const events = useHomeEvents(isOrganizer || hasAssignments);
  const mine = relevantEvents(events.data?.items ?? [], {
    isAdmin,
    organizationIds: memberships.map((m) => m.organizationId),
    assignedEventIds: assignments.map((a) => a.eventId),
  });
  const { today: todays, upcoming } = eventsByDay(mine, new Date());
  const eventName = (id: string) =>
    events.data?.items.find((e) => e.id === id)?.name ?? "Event";
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="page-stack">
      <header>
        <p className="text-muted-foreground text-sm font-semibold">
          {today.format(new Date())}
        </p>
        <h1>
          {todays.length && isOrganizer
            ? "Today is event day"
            : `Hi${firstName ? ", " + firstName : ""}`}
        </h1>
      </header>

      {isAdmin && <AdminSummary eventsTotal={events.data?.total} />}

      {isOrganizer && todays.map((e) => <EventDay key={e.id} event={e} />)}

      {(isOrganizer || hasAssignments) && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          {hasAssignments ? (
            <Card title="My assignments" icon={<ClipboardList size={18} />}>
              <ul className="grid gap-1">
                {assignments.map((a) => (
                  <li key={`${a.eventId}-${a.competitionId}-${a.role}`}>
                    <Link
                      href={ROUTES.eventManagement.detail(a.eventId)}
                      className="hover:bg-muted flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                    >
                      <span>
                        <b>{eventName(a.eventId)}</b>
                        <span className="text-muted-foreground block text-sm">
                          {ROLE_LABEL[a.role] ?? a.role}
                          {a.competitionId
                            ? " · one competition"
                            : " · whole event"}
                        </span>
                      </span>
                      <ArrowRight size={16} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card title="Today" icon={<CalendarDays size={18} />}>
              <p className="text-muted-foreground">
                {events.isPending
                  ? "Loading…"
                  : todays.length
                    ? "Open the event above to run today's competitions."
                    : "No event today."}
              </p>
            </Card>
          )}
          <Card title="Coming up" icon={<CalendarDays size={18} />}>
            {events.isSuccess && upcoming.length === 0 && (
              <p className="text-muted-foreground">Nothing scheduled.</p>
            )}
            <ul className="grid gap-2">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <UpcomingEvent event={e} />
                </li>
              ))}
            </ul>
            <Link
              href={ROUTES.eventManagement.root}
              className="mt-3 inline-block font-semibold"
            >
              All events
            </Link>
          </Card>
        </div>
      )}

      {!isAdmin && !isOrganizer && !hasAssignments && (
        <Card title="Nothing to manage yet" icon={<Inbox size={18} />}>
          <p className="text-muted-foreground">
            Events you organize, or competitions you are assigned to as a
            committee member or judge, will show up here.
          </p>
        </Card>
      )}
    </div>
  );
}

function EventDay({ event }: { event: Event }) {
  const competitions = useEventCompetitions(event.id);
  return (
    <section className="bg-brand grid gap-4 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-primary-dark text-xs font-bold tracking-widest">
            EVENT DAY
          </span>
          <h2 className="font-display text-2xl">{event.name}</h2>
          <p className="text-primary-dark">
            {formatDateTime(event.startAt)} – {formatDateTime(event.endAt)}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </p>
        </div>
        <Link
          href={ROUTES.eventManagement.detail(event.id)}
          className="link-button"
        >
          Open event <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <ul className="grid gap-2 rounded-xl bg-white p-3">
        {competitions.isPending && (
          <li className="text-muted-foreground px-2">Loading competitions…</li>
        )}
        {competitions.data?.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5"
          >
            <b>{c.name}</b>
            <span className="text-muted-foreground text-sm">
              {formatDateTime(c.startAt)}
              {c.capacity ? ` · ${c.capacity} slots` : ""}
            </span>
          </li>
        ))}
        {competitions.isSuccess && competitions.data.length === 0 && (
          <li className="text-muted-foreground px-2">No competitions yet.</li>
        )}
      </ul>
    </section>
  );
}

function UpcomingEvent({ event }: { event: Event }) {
  const start = new Date(event.startAt);
  return (
    <Link
      href={ROUTES.eventManagement.detail(event.id)}
      className="hover:bg-muted flex items-center gap-3 rounded-xl p-2"
    >
      <span className="bg-primary-soft text-primary-dark grid w-12 shrink-0 justify-items-center rounded-xl py-1.5">
        <b className="font-mono text-lg leading-none">{start.getDate()}</b>
        <span className="text-[11px] font-bold uppercase">
          {start.toLocaleString("en-GB", { month: "short" })}
        </span>
      </span>
      <span className="min-w-0">
        <b className="block truncate">{event.name}</b>
        <span className="text-muted-foreground block truncate text-sm">
          {event.venueName || "Venue to be announced"}
        </span>
      </span>
    </Link>
  );
}

function AdminSummary({ eventsTotal }: { eventsTotal?: number }) {
  const pending = usePendingApplicationsCount(true);
  const users = useUsersCount(true);
  const organizations = useOrganizationsCount(true);
  const value = (q: { data?: number; isError: boolean }) =>
    q.isError ? "–" : (q.data ?? "…");
  return (
    <section className="grid [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] gap-3">
      <Link
        href={ROUTES.organizationManagement}
        className="border-border hover:border-primary grid gap-1 rounded-2xl border bg-white p-5"
      >
        <span className="text-muted-foreground text-sm font-semibold">
          Organizer applications
        </span>
        <b className="font-mono text-3xl font-semibold">{value(pending)}</b>
        <span className="text-muted-foreground text-sm">
          waiting for review
        </span>
      </Link>
      <Stat label="Events" value={eventsTotal ?? "…"} />
      <Stat label="Users" value={value(users)} />
      <Stat label="Organizations" value={value(organizations)} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-border grid gap-1 rounded-2xl border bg-white p-5">
      <span className="text-muted-foreground text-sm font-semibold">
        {label}
      </span>
      <b className="font-mono text-3xl font-semibold">{value}</b>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border rounded-2xl border bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2">
        <span className="text-primary" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
