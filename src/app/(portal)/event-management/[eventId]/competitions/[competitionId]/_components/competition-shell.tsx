"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { TabNav, type TabNavItem } from "@/components/common/tab-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  committeeCount,
  competitionMeta,
} from "@/domains/competitions/overview";
import {
  useCompetition,
  useCompetitionRules,
  useCompetitionTypes,
  useSpecies,
} from "@/domains/competitions/queries";
import {
  COMPETITION_STATUS_LABEL,
  currentRule,
  type CompetitionStatus,
} from "@/domains/competitions/types";
import { useCompetitionEntryCounts, useEvent } from "@/domains/events/queries";
import { useEventStaff } from "@/domains/staff/queries";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import {
  CompetitionLoadError,
  CompetitionNotFound,
} from "./competition-load-error";
import { TypeBadge } from "./type-badge";

/** Status yang membuat Live Mode tidak berguna (belum dipublikasikan atau dibatalkan). */
const LIVE_BLOCKED_STATUSES: readonly CompetitionStatus[] = [
  "DRAFT",
  "CANCELLED",
];

/**
 * Lima tab kompetisi sesuai desain CompHeader. Hitungan `null` berarti belum ada atau gagal
 * dimuat (mis. akun tidak boleh melihat peserta) dan tab tampil tanpa angka.
 */
export function competitionTabs(
  eventId: string,
  competitionId: string,
  counts: { participants: number | null; committee: number | null },
): TabNavItem[] {
  const base = ROUTES.eventManagement.competitionDetail(eventId, competitionId);
  return [
    { label: "Overview", href: base, exact: true },
    {
      label: "Participants",
      href: base + "/participants",
      count: counts.participants,
    },
    {
      label: "Committee",
      href: base + "/committee",
      count: counts.committee,
    },
    { label: "Settings", href: base + "/settings" },
    { label: "Results", href: base + "/results" },
  ];
}

/**
 * Header + tab yang dipakai semua halaman kompetisi (layout `[competitionId]/(workspace)`):
 * breadcrumb, badge jenis dan status, nama, baris meta, tombol Edit (hanya bila berhak)
 * dan Open Live Mode (tautan ke Live Mode; nonaktif untuk Draft/Cancelled), lalu bar tab dengan hitungan.
 * Hitungan memakai query yang sama dengan halaman tab, jadi tidak ada request tambahan.
 */
export function CompetitionShell({
  eventId,
  competitionId,
  children,
}: {
  eventId: string;
  competitionId: string;
  children: ReactNode;
}) {
  const event = useEvent(eventId);
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const species = useSpecies();
  const rules = useCompetitionRules(competitionId);
  const entries = useCompetitionEntryCounts(eventId, [competitionId]);
  const staff = useEventStaff(eventId);
  const { canOnEvent } = useAuth();

  if (competition.isError)
    return (
      <CompetitionLoadError
        error={competition.error}
        eventId={eventId}
        onRetry={() => competition.refetch()}
      />
    );
  const c = competition.data;
  if (c && c.eventId !== eventId)
    return <CompetitionNotFound eventId={eventId} />;

  const type = c && types.data?.find((t) => t.id === c.typeId);
  // Kompetisi tanpa hewan tertentu: "Any animal". Nama belum dimuat: bagian ini dilewati.
  const speciesLabel = !c
    ? null
    : c.speciesId
      ? (species.data?.find((s) => s.id === c.speciesId)?.name ?? null)
      : "Any animal";
  const participants = entries.counts[competitionId] ?? null;
  const committee = staff.data
    ? committeeCount(staff.data, competitionId)
    : null;
  const meta = competitionMeta({
    speciesLabel,
    participants,
    rule: currentRule(rules.data ?? []),
  });
  const tabs = competitionTabs(eventId, competitionId, {
    participants,
    committee,
  });
  const canEdit =
    !!event.data && canOnEvent(event.data, PERMISSION.COMPETITION_UPDATE);

  return (
    <div className="grid gap-4.5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-2"
      >
        <Link
          href={ROUTES.eventManagement.root}
          className="text-primary font-semibold"
        >
          Events
        </Link>
        <ChevronRight size={14} aria-hidden />
        <Link
          href={ROUTES.eventManagement.detail(eventId)}
          className="text-primary font-semibold"
        >
          {event.data?.name ?? "Event"}
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">
          {c?.name ?? "Loading..."}
        </span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-2">
          {c ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {type && (
                <TypeBadge resultMode={type.resultMode} name={type.name} />
              )}
              <StatusBadge
                status={COMPETITION_STATUS_LABEL[c.status]}
                label={COMPETITION_STATUS_LABEL[c.status]}
              />
            </div>
          ) : (
            <Skeleton className="h-6 w-40" />
          )}
          <h1 className="font-display text-[30px] leading-8.5 font-bold wrap-break-word">
            {c?.name ?? "Loading competition..."}
          </h1>
          {c ? (
            <p className="text-primary-dark flex flex-wrap gap-x-4.5 gap-y-1">
              {meta.map((part) => (
                <span key={part}>{part}</span>
              ))}
            </p>
          ) : (
            <Skeleton className="h-4 w-72 max-w-full" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {c && canEdit && (
            <Link
              href={ROUTES.eventManagement.competitionEdit(
                eventId,
                competitionId,
              )}
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "min-h-11 rounded-xl px-4 font-bold",
              )}
            >
              Edit
            </Link>
          )}
          {/* Live Mode tidak berarti untuk kompetisi Draft/Cancelled; tooltip di span karena tombol disabled tidak menerima hover. */}
          {c && !LIVE_BLOCKED_STATUSES.includes(c.status) ? (
            <Link
              href={ROUTES.live(competitionId)}
              className={cn(
                buttonVariants(),
                "min-h-11 rounded-xl px-4 font-bold",
              )}
            >
              <Play size={14} aria-hidden /> Open Live Mode
            </Link>
          ) : (
            <span
              title={
                c
                  ? "Live Mode is not available for a draft or cancelled competition"
                  : undefined
              }
            >
              <Button disabled className="min-h-11 rounded-xl px-4 font-bold">
                <Play size={14} aria-hidden /> Open Live Mode
              </Button>
            </span>
          )}
        </div>
      </header>

      <TabNav label="Competition sections" items={tabs} />

      <div className="mt-1.5 grid min-w-0 gap-5">{children}</div>
    </div>
  );
}
