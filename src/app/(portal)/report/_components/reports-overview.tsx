"use client";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ListPageHeader } from "@/components/common/list-page-header";
import { MockBanner } from "@/components/common/mock-banner";
import { SectionCard } from "@/components/common/page-layout";
import {
  ReportRows,
  StatCard,
  type ReportRow,
} from "@/components/common/report-parts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  REPORTS_API_IS_MOCK,
  REPORTS_MOCK_BANNER,
} from "@/domains/reports/constants";
import {
  overviewCsvRows,
  paidPercent,
  revenueLabel,
} from "@/domains/reports/format";
import { useReportsOverview } from "@/domains/reports/queries";
import { exportCsv } from "@/lib/export-csv";
import { ROUTES } from "@/lib/constants/routes";

/** Kerangka saat ringkasan dimuat. */
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
 * Halaman Reports (menu Insight): ringkasan semua event yang boleh dikelola pemanggil, satu baris
 * per event dengan tautan ke tab Reports event itu, dan export CSV. Menggantikan halaman legacy
 * Report. Angka datang dari `GET /reports/overview` (dihitung server, tanpa memuat semua koleksi).
 * Kondisi: loading, error (+ retry), tanpa event.
 */
export function ReportsOverview() {
  const overview = useReportsOverview();

  const header = (
    <ListPageHeader
      title="Reports"
      description="Registrations, payments and revenue for the events you manage."
    />
  );

  if (overview.isError)
    return (
      <div className="grid gap-5">
        {header}
        <ErrorState
          error={overview.error}
          fallback="Unable to load the reports."
          onRetry={() => void overview.refetch()}
        />
      </div>
    );
  if (!overview.data)
    return (
      <div className="grid gap-5">
        {header}
        <Loading />
      </div>
    );

  const data = overview.data;
  const rows: ReportRow[] = data.events.map((e) => ({
    key: e.eventId,
    title: e.name,
    subtitle: `${e.organizationName} · ${e.status.toLowerCase()}`,
    href: `${ROUTES.eventManagement.detail(e.eventId)}/reports`,
    cells: [
      String(e.competitions),
      String(e.entries),
      String(e.paidEntries),
      revenueLabel(e.revenue),
    ],
  }));

  return (
    <div className="grid min-w-0 gap-5">
      {header}
      <MockBanner show={REPORTS_API_IS_MOCK} message={REPORTS_MOCK_BANNER} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events"
          value={data.totals.events}
          note={`${data.totals.competitions} competitions`}
        />
        <StatCard label="Entries" value={data.totals.entries} />
        <StatCard
          label="Paid"
          value={data.totals.paidEntries}
          note={`${paidPercent(data.totals.paidEntries, data.totals.entries)}% of entries`}
        />
        <StatCard
          label="Revenue"
          value={revenueLabel(data.totals.revenue)}
          note="Registration fees of paid entries"
        />
      </div>
      <SectionCard
        title="Events"
        description="Open an event to see its competitions and export its participants."
        action={
          <Button
            variant="secondary"
            disabled={rows.length === 0}
            onClick={() => exportCsv("events-report", overviewCsvRows(data))}
          >
            Export
          </Button>
        }
      >
        {rows.length === 0 ? (
          <EmptyState icon={BarChart3} message="No events to report on yet." />
        ) : (
          <ReportRows
            caption="Events summary"
            nameLabel="Event"
            columns={[
              { label: "Competitions" },
              { label: "Entries" },
              { label: "Paid" },
              { label: "Revenue" },
            ]}
            rows={rows}
            footer={[
              String(data.totals.competitions),
              String(data.totals.entries),
              String(data.totals.paidEntries),
              revenueLabel(data.totals.revenue),
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}
