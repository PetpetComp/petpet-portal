"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetitionTypes,
  useEventCompetitions,
} from "@/domains/competitions/queries";
import {
  useCompetitionEntryCounts,
  useEvent,
  useEventEntryCount,
  useEventSponsors,
  useEventStaffCount,
  usePublishEvent,
} from "@/domains/events/queries";
import {
  COMPETITION_KIND_BAR,
  barPercent,
  kindOfCompetition,
  kindSummary,
  setupSteps,
  sponsorSummary,
} from "@/domains/events/overview";
import { isPublished } from "@/domains/events/types";
import { useAuth } from "@/hooks/use-auth";
import { PERMISSION } from "@/lib/auth/permissions";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

const CARD = "border-border rounded-2xl border bg-white px-6 py-5";

/**
 * Halaman Overview event (tab pertama), sesuai desain Ev-Overview:
 * tiga kartu ringkas, bar "Participants per competition" (warna per jenis lomba),
 * dan checklist Setup. Semua angka berasal dari hook (cache bersama header tab).
 * Hitungan yang gagal dimuat tampil "-" dengan catatan, tidak menjatuhkan seluruh halaman.
 */
export function EventOverview({ eventId }: { eventId: string }) {
  const { canOnEvent } = useAuth();
  const event = useEvent(eventId);
  const competitions = useEventCompetitions(eventId);
  const types = useCompetitionTypes();
  const entries = useEventEntryCount(eventId);
  const sponsors = useEventSponsors(eventId);
  const staff = useEventStaffCount(eventId);
  const publish = usePublishEvent(eventId);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const base = ROUTES.eventManagement.detail(eventId);

  const list = competitions.data ?? [];
  const typeList = types.data ?? [];
  const perCompetition = useCompetitionEntryCounts(
    eventId,
    list.map((c) => c.id),
  );
  const rows = list
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: perCompetition.counts[c.id],
      kind: kindOfCompetition(c, typeList),
    }))
    .sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  const maxCount = Math.max(0, ...rows.map((r) => r.count ?? 0));

  const steps = setupSteps({
    competitions: competitions.isSuccess ? list.length : null,
    staff: staff.isError ? null : (staff.data ?? null),
    sponsors: sponsors.isError ? null : (sponsors.data?.total ?? null),
    published: !!event.data && isPublished(event.data),
  });
  const canPublish =
    !!event.data &&
    event.data.status === "DRAFT" &&
    canOnEvent(event.data, PERMISSION.EVENT_PUBLISH);

  function publishNow() {
    publish.mutate(undefined, {
      onSuccess: () => toast.success("Event published"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to publish.",
        ),
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <Stat
          href={base + "/competitions"}
          label="Competitions"
          value={
            competitions.isSuccess
              ? list.length
              : competitions.isError
                ? null
                : undefined
          }
          note={
            competitions.isSuccess
              ? kindSummary(list, typeList) || "No competitions yet"
              : competitions.isError
                ? "Could not be loaded"
                : ""
          }
        />
        <Stat
          href={base + "/participants"}
          label="Participants"
          value={entries.isError ? null : entries.data}
          note={
            entries.isError
              ? "Not available for your account"
              : "entries across all competitions"
          }
        />
        <Stat
          href={base + "/sponsors"}
          label="Sponsors"
          value={sponsors.isError ? null : sponsors.data?.total}
          note={
            sponsors.isError
              ? "Not available for your account"
              : sponsors.data
                ? sponsorSummary(sponsors.data.byLevel) || "No sponsors yet"
                : ""
          }
        />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section
          className={cn(CARD, "grid min-w-0 flex-[999_1_460px] gap-3.5")}
        >
          <h2 className="text-base font-bold">Participants per competition</h2>
          {competitions.isPending && (
            <div className="grid gap-3" aria-busy>
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-4 w-full" />
              ))}
            </div>
          )}
          {competitions.isSuccess && rows.length === 0 && (
            <p className="text-muted-foreground">
              No competitions yet.{" "}
              <Link
                href={ROUTES.eventManagement.createCompetition(eventId)}
                className="text-primary font-semibold"
              >
                Add the first one
              </Link>
            </p>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,190px)_minmax(0,1fr)_40px] items-center gap-3"
            >
              <span className="truncate">{row.name}</span>
              <div
                className="bg-muted h-2.5 rounded-full"
                role="img"
                aria-label={`${row.name}: ${row.count ?? "unknown"} participants`}
              >
                <div
                  className={cn(
                    "h-2.5 rounded-full",
                    COMPETITION_KIND_BAR[row.kind],
                  )}
                  style={{ width: `${barPercent(row.count ?? 0, maxCount)}%` }}
                />
              </div>
              <b className="text-right">{row.count ?? "-"}</b>
            </div>
          ))}
        </section>

        <section className={cn(CARD, "grid min-w-0 flex-[1_1_300px] gap-3")}>
          <h2 className="text-base font-bold">Setup</h2>
          <ul className="grid gap-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                {s.done ? (
                  <span className="bg-done-soft text-done grid size-6 place-items-center rounded-full">
                    <Check size={14} strokeWidth={3} aria-label="Done" />
                  </span>
                ) : (
                  <Circle
                    size={24}
                    className="text-input"
                    aria-label="Not yet"
                  />
                )}
                <span className={s.done ? "" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
          {canPublish && (
            <Button
              className="mt-1 min-h-11 rounded-xl font-bold"
              disabled={publish.isPending}
              onClick={() => setConfirmPublish(true)}
            >
              Publish event
            </Button>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish event"
        description="Publishing makes the event public and opens its draft competitions for registration."
        confirmLabel="Publish"
        onConfirm={publishNow}
      />
    </div>
  );
}

/**
 * Kartu angka di atas Overview. `value`: undefined = sedang dimuat, null = gagal dimuat.
 * Seluruh kartu adalah tautan ke tab yang bersangkutan.
 */
function Stat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: number | null | undefined;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border-border hover:border-primary grid gap-1 rounded-2xl border bg-white px-5 py-4.5 transition-colors"
    >
      <span className="text-muted-foreground">{label}</span>
      <b className="font-display text-[34px] leading-10">
        {value === undefined ? "…" : (value ?? "–")}
      </b>
      <span className="text-muted-foreground">{note}</span>
    </Link>
  );
}
