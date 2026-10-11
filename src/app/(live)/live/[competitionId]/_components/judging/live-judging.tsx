"use client";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import { JUDGING_UNSUPPORTED_MESSAGE } from "@/domains/judging/constants";
import { useJudging } from "@/domains/judging/queries";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { isJudgingTypeCode } from "../live-family";
import { JudgingBoard } from "./judging-board";

/** Kerangka saat data dimuat. */
function Loading() {
  return (
    <div
      className="grid gap-4 p-4 md:grid-cols-[260px_1fr] md:p-7"
      aria-busy
      aria-label="Loading judging"
    >
      <Skeleton className="h-64 w-full md:col-start-1" />
      <div className="grid gap-4 md:col-start-2 md:row-start-1">
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

/**
 * Layar Judging Live Mode (Contest). Dipanggil dari `judging/page.tsx`.
 * Memuat kompetisi + tipenya; selain BEAUTY dan BEST_IN_SHOW hanya penjelasan dengan link ke
 * langkah yang benar. Untuk Contest memuat `/judging`: 403 -> "No access", 404 -> tidak
 * ditemukan, error lain -> kartu error dengan "Try again"; sukses -> JudgingBoard.
 */
export function LiveJudging({ competitionId }: { competitionId: string }) {
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const type = types.data?.find((t) => t.id === competition.data?.typeId);
  const contest = isJudgingTypeCode(type?.code);
  const judging = useJudging(competitionId, contest);

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
  if (!contest)
    return (
      <div className="p-4 md:p-7">
        <div className="border-border bg-card mx-auto grid max-w-lg justify-items-center gap-3 rounded-2xl border p-8 text-center">
          <Gavel size={28} className="text-primary-dark" aria-hidden />
          <p className="text-muted-foreground">
            {JUDGING_UNSUPPORTED_MESSAGE}. This competition uses another format.
          </p>
          <Link
            href={ROUTES.liveDrawing(competitionId)}
            className={cn(buttonVariants(), "min-h-11")}
          >
            Go to Drawing
          </Link>
        </div>
      </div>
    );

  if (judging.isError && !judging.data) {
    if (judging.error instanceof ApiError && judging.error.status === 403)
      return <Forbidden />;
    const notFound =
      judging.error instanceof ApiError && judging.error.status === 404;
    return (
      <div className="p-4 md:p-7">
        <ErrorState
          error={judging.error}
          fallback={
            notFound
              ? "Judging was not found for this competition."
              : "Unable to load the judging queue."
          }
          onRetry={notFound ? undefined : () => void judging.refetch()}
        />
      </div>
    );
  }
  if (!judging.data) return <Loading />;

  return <JudgingBoard competitionId={competitionId} judging={judging.data} />;
}
