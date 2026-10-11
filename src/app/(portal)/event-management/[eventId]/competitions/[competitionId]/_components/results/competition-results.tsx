"use client";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import {
  RESULTS_API_IS_MOCK,
  RESULTS_MOCK_BANNER,
  RESULTS_UNSUPPORTED_MESSAGE,
} from "@/domains/results/constants";
import {
  useCompetitionResults,
  useVerifyResults,
} from "@/domains/results/queries";
import { ResultsPodium } from "./results-podium";
import { ResultsRanking } from "./results-ranking";

/** Banner kuning selama API hasil belum ada; satu konstanta di domains/results/constants.ts. */
function MockBanner() {
  if (!RESULTS_API_IS_MOCK) return null;
  return (
    <p
      role="note"
      className="bg-warning-soft text-event-day-ink rounded-xl px-4 py-3 text-sm font-semibold"
    >
      {RESULTS_MOCK_BANNER}
    </p>
  );
}

/** Kerangka saat data dimuat: banner, podium, lalu kartu klasemen. */
function Loading() {
  return (
    <div className="grid gap-5" aria-busy>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Tab Results kompetisi (desain Comp-Results), hanya varian Race (keputusan D13).
 * Tipe lain menampilkan pesan "belum tersedia" dan tidak memanggil API. Race: banner mock,
 * podium, kartu Final ranking. Kondisi: loading (skeleton), error (ErrorState + retry),
 * kosong (belum ada hasil). Dipanggil dari `(workspace)/results/page.tsx`.
 */
export function CompetitionResults({
  competitionId,
}: {
  competitionId: string;
}) {
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const type = types.data?.find((t) => t.id === competition.data?.typeId);
  const isRace = type?.code === "RACE";
  const results = useCompetitionResults(competitionId, isRace);
  const verify = useVerifyResults(competitionId);

  if (competition.isError || types.isError)
    return (
      <ErrorState
        error={competition.error ?? types.error}
        fallback="Unable to load this competition."
        onRetry={() => {
          void competition.refetch();
          void types.refetch();
        }}
      />
    );
  if (!competition.data || !type) return <Loading />;

  if (!isRace)
    return <EmptyState icon={Trophy} message={RESULTS_UNSUPPORTED_MESSAGE} />;

  if (results.isError)
    return (
      <div className="grid gap-5">
        <MockBanner />
        <ErrorState
          error={results.error}
          fallback="Unable to load the results."
          onRetry={() => void results.refetch()}
        />
      </div>
    );
  if (!results.data) return <Loading />;

  const data = results.data;
  if (data.rows.length === 0)
    return (
      <div className="grid gap-5">
        <MockBanner />
        <EmptyState
          icon={Trophy}
          message="No results yet. The ranking appears here once the race has finished."
        />
      </div>
    );

  const handleVerify = () =>
    verify.mutate(undefined, {
      onSuccess: () => toast.success("Results verified"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to verify results.",
        ),
    });

  return (
    <div className="grid min-w-0 gap-5">
      <MockBanner />
      <ResultsPodium rows={data.rows} />
      <ResultsRanking
        results={data}
        fileName={`results-${competition.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        onVerify={handleVerify}
        verifying={verify.isPending}
      />
    </div>
  );
}
