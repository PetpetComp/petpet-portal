"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Pencil } from "lucide-react";
import { Can } from "@/components/common/can";
import { StatusBadge } from "@/components/common/status-badge";
import { useEvent, useOrganizerNames } from "@/domains/events/queries";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { eventInitials } from "../../_lib/event-rules";

/**
 * Tabs appear here as their pages ship (docs/08 §6, F1 to F2).
 * Committee, Sponsors and Doorprize come next.
 */
function tabsFor(eventId: string) {
  const base = ROUTES.eventManagement.detail(eventId);
  return [
    { label: "Overview", href: base, exact: true },
    { label: "Competitions", href: base + "/competitions", exact: false },
    { label: "Registrations", href: base + "/registrations", exact: false },
    { label: "Participants", href: base + "/participants", exact: false },
  ];
}

const titleCase = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "";

export function EventShell({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const event = useEvent(eventId);
  const organizers = useOrganizerNames();

  if (event.isError)
    return (
      <div role="alert" className="page-stack">
        <p>
          {event.error instanceof Error
            ? event.error.message
            : "Unable to load this event."}
        </p>
        <Link href={ROUTES.eventManagement.root}>Back to events</Link>
      </div>
    );

  const e = event.data;
  return (
    <div className="page-stack">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex items-center gap-2 text-sm"
      >
        <Link href={ROUTES.eventManagement.root} className="font-semibold">
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">
          {e?.name ?? "Loading…"}
        </span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="bg-brand text-primary-dark font-display grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold"
          >
            {e ? eventInitials(e.name) : ""}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold break-words">
                {e?.name ?? "Loading event…"}
              </h1>
              {e && <StatusBadge status={titleCase(e.status)} />}
            </div>
            {e && (
              <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  {formatDateTime(e.startAt)} – {formatDateTime(e.endAt)}
                </span>
                {e.venueName && <span>{e.venueName}</span>}
                {organizers.data?.[e.organizationId] && (
                  <span>
                    by <b>{organizers.data[e.organizationId]}</b>
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <Can permission={PERMISSION.EVENT_UPDATE}>
          <Link
            href={ROUTES.eventManagement.edit(eventId)}
            className="link-button"
          >
            <Pencil size={14} />
            Edit event
          </Link>
        </Can>
      </header>

      <nav
        aria-label="Event sections"
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {tabsFor(eventId).map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-primary-dark flex min-h-11 items-center border-b-2 px-3.5 font-semibold whitespace-nowrap",
                active ? "border-primary font-bold" : "border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
