"use client";
import Link from "next/link";
import { Flag, Shuffle } from "lucide-react";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import { MATCHES_UNSUPPORTED_MESSAGE } from "@/domains/matches/constants";
import { useMatches } from "@/domains/matches/queries";
import {
  MATCH_RUN_STATUS_LABEL,
  type MatchRunStatus,
  type MatchSummary,
} from "@/domains/matches/types";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { MatchesMockBanner } from "./run/run-match";

const STATUS_STYLE: Record<MatchRunStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  RUNNING: "bg-event-day-soft text-event-day-ink",
  DONE: "bg-success-soft text-done",
};

/** Teks tombol di kartu: Run match, Resume (sedang berjalan), atau View result (selesai). */
const ACTION_LABEL: Record<MatchRunStatus, string> = {
  NOT_STARTED: "Run match",
  RUNNING: "Resume",
  DONE: "View result",
};

/**
 * Kartu satu match di daftar. Dipanggil dari LiveMatches.
 * `highlighted` = match berikutnya yang harus dijalankan: bingkai tebal, tag "Next", dan tombol
 * utama berwarna. Kartu lain memakai tombol sekunder. Semua tombol adalah link ke layar Run Match.
 */
function MatchCard({
  competitionId,
  match,
  highlighted,
}: {
  competitionId: string;
  match: MatchSummary;
  highlighted: boolean;
}) {
  return (
    <section
      aria-label={`Match ${match.number}`}
      data-next={highlighted ? "true" : undefined}
      className={cn(
        "bg-card grid content-between gap-4 rounded-2xl border p-4",
        highlighted ? "border-primary ring-primary/30 ring-4" : "border-border",
      )}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">
            Match {match.number}
          </h2>
          <span className="flex items-center gap-2">
            {highlighted && (
              <span className="bg-primary-soft text-primary-dark rounded-full px-2.5 py-1 text-xs font-bold">
                Next
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold",
                STATUS_STYLE[match.status],
              )}
            >
              {MATCH_RUN_STATUS_LABEL[match.status]}
            </span>
          </span>
        </div>
        <p className="text-muted-foreground text-[13px]">
          {match.plannedLanes.length}{" "}
          {match.plannedLanes.length === 1 ? "pet" : "pets"}
        </p>
        <ul className="grid gap-1.5">
          {match.plannedLanes.map((lane) => (
            <li
              key={lane.entryId}
              className="flex min-w-0 items-baseline gap-2"
            >
              <span className="font-display text-event-day w-5 shrink-0 text-center text-lg font-bold">
                {lane.laneNumber}
              </span>
              <span className="min-w-0 font-semibold wrap-break-word">
                {lane.petName}
              </span>
              {lane.bibNumber && (
                <span className="text-muted-foreground font-mono text-xs">
                  {lane.bibNumber}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={ROUTES.liveMatch(competitionId, match.id)}
        className={cn(
          buttonVariants({
            variant: highlighted ? "primary" : "secondary",
          }),
          "min-h-12 w-full rounded-xl text-base",
        )}
      >
        {ACTION_LABEL[match.status]}
        <span className="sr-only"> Match {match.number}</span>
      </Link>
    </section>
  );
}

/** Kerangka saat daftar dimuat. */
function Loading() {
  return (
    <div className="grid gap-4 p-4 md:p-7" aria-busy>
      <Skeleton className="h-16 w-full max-w-sm" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-56 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Pemberitahuan dengan ikon (kosong atau tipe tidak didukung), tanpa bergantung pada portal.css. */
function Notice({
  icon,
  message,
  children,
}: {
  icon: "flag" | "shuffle";
  message: string;
  children?: React.ReactNode;
}) {
  const Icon = icon === "flag" ? Flag : Shuffle;
  return (
    <div className="border-border bg-card mx-auto grid max-w-lg justify-items-center gap-3 rounded-2xl border p-8 text-center">
      <Icon size={28} className="text-primary-dark" aria-hidden />
      <p className="text-muted-foreground">{message}</p>
      {children}
    </div>
  );
}

/**
 * Tab Matches Live Mode (langkah 2). Dipanggil dari `matches/page.tsx`.
 * Memuat kompetisi + jenisnya (selain Race hanya penjelasan), lalu daftar match.
 * Kondisi: loading, error (403 -> No access), belum diundi (link ke tab Drawing), dan daftar.
 * Ringkasan "N of M matches done"; match berikutnya (`nextMatchId`) disorot dengan tombol utama.
 */
export function LiveMatches({ competitionId }: { competitionId: string }) {
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const type = types.data?.find((t) => t.id === competition.data?.typeId);
  const isRace = type?.code === "RACE";
  const matches = useMatches(competitionId, isRace);

  if (competition.isError || types.isError)
    return (
      <div className="p-4 md:p-7">
        <ErrorState
          error={competition.error ?? types.error}
          fallback="Unable to load this competition."
          onRetry={() => {
            void competition.refetch();
            void types.refetch();
          }}
        />
      </div>
    );
  if (!competition.data || !type) return <Loading />;
  if (!isRace)
    return (
      <div className="p-4 md:p-7">
        <Notice
          icon="flag"
          message={`${MATCHES_UNSUPPORTED_MESSAGE}. This competition uses another format.`}
        />
      </div>
    );

  if (matches.isError) {
    if (matches.error instanceof ApiError && matches.error.status === 403)
      return <Forbidden />;
    return (
      <div className="p-4 md:p-7">
        <ErrorState
          error={matches.error}
          fallback="Unable to load the matches."
          onRetry={() => void matches.refetch()}
        />
      </div>
    );
  }
  if (!matches.data) return <Loading />;

  const data = matches.data;
  if (!data.drawingLocked)
    return (
      <div className="grid gap-4 p-4 md:p-7">
        <MatchesMockBanner />
        <Notice
          icon="shuffle"
          message="The drawing is not locked yet, so there are no matches. Draw and lock the participants first."
        >
          <Link
            href={ROUTES.liveDrawing(competitionId)}
            className={cn(buttonVariants(), "min-h-12 rounded-xl px-5")}
          >
            Go to Drawing
          </Link>
        </Notice>
      </div>
    );

  const total = data.items.length;
  return (
    <div className="grid gap-4 p-4 md:p-7">
      <MatchesMockBanner />
      <div className="grid max-w-md gap-2">
        <p className="font-display text-2xl font-bold">
          {data.doneCount} of {total} matches done
        </p>
        <div
          role="progressbar"
          aria-label="Matches done"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={data.doneCount}
          className="bg-muted h-2 overflow-hidden rounded-full"
        >
          <div
            className="bg-success h-full rounded-full"
            style={{
              width: total === 0 ? "0%" : `${(data.doneCount / total) * 100}%`,
            }}
          />
        </div>
        {data.doneCount === total && total > 0 && (
          <Link
            href={ROUTES.liveResults(competitionId)}
            className="text-primary font-semibold"
          >
            All matches are done. View results
          </Link>
        )}
      </div>
      {total === 0 ? (
        <Notice icon="flag" message="The drawing has no matches." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
          {data.items.map((match) => (
            <MatchCard
              key={match.id}
              competitionId={competitionId}
              match={match}
              highlighted={match.id === data.nextMatchId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
