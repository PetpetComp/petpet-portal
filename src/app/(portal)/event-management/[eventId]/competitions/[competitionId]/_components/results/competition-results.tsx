"use client";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { MockBanner } from "@/components/common/mock-banner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import {
  RESULT_TYPE_CODES,
  RESULTS_API_IS_MOCK,
  RESULTS_EMPTY_MESSAGE,
  RESULTS_MOCK_BANNER,
  RESULTS_UNSUPPORTED_MESSAGE,
} from "@/domains/results/constants";
import {
  useCompetitionResults,
  useVerifyResults,
} from "@/domains/results/queries";
import { ResultsPodium } from "./results-podium";
import { ResultsRanking } from "./results-ranking";

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
 * Tab Results kompetisi (desain Comp-Results). Tiga jenis klasemen dari satu komponen: Race dan
 * Time trial (waktu), Contest (nilai juri); jenisnya datang dari API (`variant`).
 * Tipe tanpa klasemen (Checkpoint) menampilkan pesan "belum tersedia" dan tidak memanggil API.
 * Isi: banner mock, podium, kartu Final ranking. Kondisi: loading (skeleton), error (ErrorState + retry),
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
  const supported = (RESULT_TYPE_CODES as readonly string[]).includes(
    type?.code ?? "",
  );
  const results = useCompetitionResults(competitionId, supported);
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

  if (!supported)
    return <EmptyState icon={Trophy} message={RESULTS_UNSUPPORTED_MESSAGE} />;

  if (results.isError)
    return (
      <div className="grid gap-5">
        <MockBanner show={RESULTS_API_IS_MOCK} message={RESULTS_MOCK_BANNER} />
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
        <MockBanner show={RESULTS_API_IS_MOCK} message={RESULTS_MOCK_BANNER} />
        <EmptyState
          icon={Trophy}
          message={RESULTS_EMPTY_MESSAGE[data.variant]}
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
      <MockBanner show={RESULTS_API_IS_MOCK} message={RESULTS_MOCK_BANNER} />
      <ResultsPodium rows={data.rows} variant={data.variant} />
      <ResultsRanking
        results={data}
        fileName={`results-${competition.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        onVerify={handleVerify}
        verifying={verify.isPending}
      />
    </div>
  );
}
