"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ErrorState } from "@/components/common/error-state";
import { TabNav, type TabNavItem } from "@/components/common/tab-nav";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventCompetitions } from "@/domains/competitions/queries";
import { formatEventSchedule } from "@/domains/events/format";
import {
  useEvent,
  useEventEntryCount,
  useEventSponsors,
} from "@/domains/events/queries";
import { useOrganizations } from "@/domains/organizations/queries";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { EventAvatar } from "../../_components/event-avatar";
import { EventPhaseBadge } from "../../_components/event-phase-badge";

/**
 * Tujuh tab event sesuai desain EventHeader. Hitungan `null` berarti belum ada atau gagal dimuat
 * (mis. akun tidak boleh melihat peserta) dan tab tampil tanpa angka.
 * Committee, Sponsors, dan Doorprize masih halaman "coming soon" yang rapi, bukan 404.
 */
export function eventTabs(
  eventId: string,
  counts: {
    competitions: number | null;
    participants: number | null;
    sponsors: number | null;
  },
): TabNavItem[] {
  const base = ROUTES.eventManagement.detail(eventId);
  return [
    { label: "Overview", href: base, exact: true },
    {
      label: "Competitions",
      href: base + "/competitions",
      count: counts.competitions,
    },
    { label: "Registrations", href: base + "/registrations" },
    {
      label: "Participants & check-in",
      href: base + "/participants",
      count: counts.participants,
    },
    { label: "Committee", href: base + "/committee" },
    { label: "Sponsors", href: base + "/sponsors", count: counts.sponsors },
    { label: "Doorprize", href: base + "/doorprize" },
  ];
}

/**
 * Header + tab yang dipakai semua halaman event (layout `[eventId]/(workspace)`):
 * breadcrumb, kotak inisial, nama, badge status, jadwal, venue, "by organisasi",
 * tombol Edit event (hanya bila berhak), dan bar tab dengan hitungan.
 * Hitungan tab memakai query yang sama dengan halaman tab, jadi tidak ada request tambahan.
 */
export function EventShell({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const event = useEvent(eventId);
  const organizations = useOrganizations();
  const competitions = useEventCompetitions(eventId);
  const entries = useEventEntryCount(eventId);
  const sponsors = useEventSponsors(eventId);
  const { canOnEvent } = useAuth();

  if (event.isError)
    return (
      <div className="grid gap-4">
        <ErrorState
          error={event.error}
          fallback="Unable to load this event."
          onRetry={() => event.refetch()}
        />
        <Link
          href={ROUTES.eventManagement.root}
          className="text-primary font-semibold"
        >
          Back to events
        </Link>
      </div>
    );

  const e = event.data;
  const organizer = e
    ? e.organizationName ||
      organizations.data?.find((o) => o.id === e.organizationId)?.name
    : undefined;
  const schedule = e && formatEventSchedule(e.startAt, e.endAt);
  const tabs = eventTabs(eventId, {
    competitions: competitions.data?.length ?? null,
    participants: entries.data ?? null,
    sponsors: sponsors.data?.total ?? null,
  });

  return (
    <div className="grid gap-4.5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex items-center gap-2"
      >
        <Link
          href={ROUTES.eventManagement.root}
          className="text-primary font-semibold"
        >
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">
          {e?.name ?? "Loading..."}
        </span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {e ? (
            <EventAvatar name={e.name} phase={e.phase} size="lg" />
          ) : (
            <Skeleton className="size-15 shrink-0 rounded-2xl" />
          )}
          <div className="grid min-w-0 gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[30px] leading-8.5 font-bold wrap-break-word">
                {e?.name ?? "Loading event..."}
              </h1>
              {e && <EventPhaseBadge event={e} />}
            </div>
            {e && schedule ? (
              <p className="text-primary-dark flex flex-wrap gap-x-4.5 gap-y-1">
                <span>
                  {schedule.date} · {schedule.time}
                </span>
                {e.venueName && <span>{e.venueName}</span>}
                {organizer && (
                  <span>
                    by <b>{organizer}</b>
                  </span>
                )}
              </p>
            ) : (
              <Skeleton className="h-4 w-72 max-w-full" />
            )}
          </div>
        </div>
        {e && canOnEvent(e, PERMISSION.EVENT_UPDATE) && (
          <Link
            href={ROUTES.eventManagement.edit(eventId)}
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "min-h-11 rounded-xl px-4 font-bold",
            )}
          >
            Edit event
          </Link>
        )}
      </header>

      <TabNav label="Event sections" items={tabs} />

      <div className="mt-1.5 grid min-w-0 gap-5">{children}</div>
    </div>
  );
}
