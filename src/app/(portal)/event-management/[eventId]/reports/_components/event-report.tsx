"use client";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { MockBanner } from "@/components/common/mock-banner";
import { SectionCard } from "@/components/common/page-layout";
import {
  ReportRows,
  StatCard,
  type ReportRow,
} from "@/components/common/report-parts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvent } from "@/domains/events/queries";
import {
  REPORTS_API_IS_MOCK,
  REPORTS_MOCK_BANNER,
} from "@/domains/reports/constants";
import {
  competitionsCsvRows,
  paidPercent,
  participantsCsvRows,
  reportFileName,
  revenueLabel,
} from "@/domains/reports/format";
import { useEventReport } from "@/domains/reports/queries";
import { exportCsv } from "@/lib/export-csv";

/** Kerangka saat laporan dimuat: empat kartu angka lalu kartu kompetisi. */
function Loading() {
  return (
    <div className="grid gap-5" aria-busy>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Tab Reports satu event: kartu angka (entries, paid, revenue, checked in), ringkasan per
 * kompetisi dengan baris Total, dan dua export CSV (ringkasan dan peserta). Menggantikan halaman
 * legacy Event Participant. Angka datang dari `GET /events/{uuid}/report` (dihitung server).
 * Dipanggil dari `(workspace)/reports/page.tsx`. Kondisi: loading, error (+ retry), tanpa kompetisi.
 */
export function EventReport({ eventId }: { eventId: string }) {
  const report = useEventReport(eventId);
  const event = useEvent(eventId);

  if (report.isError)
    return (
      <ErrorState
        error={report.error}
        fallback="Unable to load the report."
        onRetry={() => void report.refetch()}
      />
    );
  if (!report.data) return <Loading />;

  const data = report.data;
  const eventName = event.data?.name ?? "event";
  const rows: ReportRow[] = data.competitions.map((c) => ({
    key: c.competitionId,
    title: c.name,
    subtitle: `${c.typeCode.replaceAll("_", " ").toLowerCase()} · ${c.status.toLowerCase()}`,
    cells: [
      String(c.entries),
      String(c.paidEntries),
      String(c.checkedIn),
      revenueLabel(c.revenue),
    ],
  }));

  return (
    <div className="grid min-w-0 gap-5">
      <MockBanner show={REPORTS_API_IS_MOCK} message={REPORTS_MOCK_BANNER} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entries"
          value={data.totals.entries}
          note={`${data.totals.competitions} competitions`}
        />
        <StatCard
          label="Paid"
          value={data.totals.paidEntries}
          note={`${paidPercent(data.totals.paidEntries, data.totals.entries)}% of entries, ${data.totals.unpaidEntries} unpaid`}
        />
        <StatCard
          label="Revenue"
          value={revenueLabel(data.totals.revenue)}
          note="Registration fees of paid entries"
        />
        <StatCard
          label="Checked in"
          value={data.totals.checkedIn}
          note={`${paidPercent(data.totals.checkedIn, data.totals.entries)}% of entries`}
        />
      </div>

      <SectionCard
        title="Competitions"
        description="Registrations, payments and check-in per competition."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={rows.length === 0}
              onClick={() =>
                exportCsv(
                  reportFileName("competitions", eventName),
                  competitionsCsvRows(data),
                )
              }
            >
              Export summary
            </Button>
            <Button
              variant="secondary"
              disabled={data.participants.length === 0}
              onClick={() =>
                exportCsv(
                  reportFileName("participants", eventName),
                  participantsCsvRows(data),
                )
              }
            >
              Export participants
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            message="No competitions yet. Add one to see its numbers here."
          />
        ) : (
          <ReportRows
            caption="Competitions summary"
            nameLabel="Competition"
            columns={[
              { label: "Entries" },
              { label: "Paid" },
              { label: "Checked in" },
              { label: "Revenue" },
            ]}
            rows={rows}
            footer={[
              String(data.totals.entries),
              String(data.totals.paidEntries),
              String(data.totals.checkedIn),
              revenueLabel(data.totals.revenue),
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}
