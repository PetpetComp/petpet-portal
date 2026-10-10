"use client";
import { useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  DataTable,
  type Column,
  type Sort,
} from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { useEventCompetitions } from "@/domains/competitions/queries";
import {
  useEventEntries,
  useMarkPaid,
  useReviewEntry,
} from "@/domains/entries/queries";
import {
  ELIGIBILITY_LABEL,
  ELIGIBILITY_STATUSES,
  ENTRY_STATUS_LABEL,
  PAYMENT_LABEL,
  type EligibilityStatus,
  type Entry,
  type EntryListQuery,
  type EntrySort,
} from "@/domains/entries/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { PERMISSION } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format/date";
import { rupiah } from "@/lib/format/label";
import { cn } from "@/lib/utils";
import { RegisterPetDrawer } from "./register-pet-drawer";

/** Table column -> API `sort`. Only these columns get a sort button. */
const SORT_BY_COLUMN: Record<string, EntrySort> = {
  pet: "pet_name",
  owner: "owner_name",
  registered: "registered_at",
};

/** Filter selects show labels; the API wants the enum value behind the label. */
function valueOf<T extends string>(
  labels: Record<T, string>,
  label: string | undefined,
): T | undefined {
  return (Object.keys(labels) as T[]).find((key) => labels[key] === label);
}

const petLabel = (e: Entry) => e.petName ?? "Team entry";

/** F2.1: every registration of the event, filtered, sorted and paged by the API. */
export function EventRegistrations({ eventId }: { eventId: string }) {
  const competitions = useEventCompetitions(eventId);
  const review = useReviewEntry(eventId);
  const markPaid = useMarkPaid(eventId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toReject, setToReject] = useState<Entry | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [reviewFilter, setReviewFilter] = useState<EligibilityStatus | "">("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({
    status: ENTRY_STATUS_LABEL.REGISTERED,
  });
  const [sort, setSort] = useState<Sort>({ key: "registered", direction: -1 });
  const q = useDebouncedValue(search);

  const query: EntryListQuery = {
    competitionId: competitions.data?.find(
      (c) => c.name === filters.competition,
    )?.id,
    eligibility: reviewFilter || undefined,
    payment: valueOf(PAYMENT_LABEL, filters.payment),
    status: valueOf(ENTRY_STATUS_LABEL, filters.status),
    q,
    sort: SORT_BY_COLUMN[sort.key],
    direction: sort.direction === 1 ? "asc" : "desc",
    page: page + 1,
    perPage: pageSize,
  };
  const entries = useEventEntries(eventId, query);
  const summary = entries.data?.summary;

  function decide(entry: Entry, decision: "approve" | "reject") {
    review.mutate(
      { id: entry.id, decision },
      {
        onSuccess: () =>
          toast.success(
            decision === "approve"
              ? "Registration approved"
              : "Registration rejected",
          ),
        onError: (cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "Unable to save the review.",
          ),
      },
    );
  }

  /**
   * Simulasi pembayaran (kontrak 13 bagian 2): belum ada sistem bayar, jadi panitia menandai
   * lunas manual. Dipanggil dari tombol "Mark paid" di kolom aksi.
   */
  function pay(entry: Entry) {
    markPaid.mutate(entry.id, {
      onSuccess: () => toast.success("Marked as paid (simulation)"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to mark as paid.",
        ),
    });
  }

  const columns: Column<Entry>[] = [
    {
      key: "pet",
      label: "Pet",
      value: petLabel,
      render: (e) => (
        <span>
          <b>{petLabel(e)}</b>
          <span className="text-muted-foreground block font-mono text-xs whitespace-nowrap">
            {[e.bib && `#${e.bib}`, e.participantCode]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      value: (e) => e.ownerName,
      render: (e) => (
        <span>
          {e.ownerName}
          {e.ownerPhone && (
            <span className="text-muted-foreground block text-xs">
              {e.ownerPhone}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "competition",
      label: "Competition",
      filter: {
        type: "select",
        options: (competitions.data ?? []).map((c) => c.name),
      },
      render: (e) => e.competitionName,
    },
    {
      key: "payment",
      label: "Payment",
      filter: { type: "select", options: Object.values(PAYMENT_LABEL) },
      render: (e) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={PAYMENT_LABEL[e.payment]} />
          <small className="text-muted-foreground">{rupiah(e.fee)}</small>
        </span>
      ),
    },
    {
      key: "review",
      label: "Review",
      render: (e) =>
        e.status === "WITHDRAWN" ? (
          <StatusBadge status={ENTRY_STATUS_LABEL.WITHDRAWN} />
        ) : (
          <StatusBadge status={ELIGIBILITY_LABEL[e.eligibility]} />
        ),
    },
    {
      key: "registered",
      label: "Registered",
      value: (e) => e.registeredAt,
      render: (e) => formatDateTime(e.registeredAt),
    },
  ];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by review status"
          className="flex flex-wrap gap-2"
        >
          {(["", ...ELIGIBILITY_STATUSES] as const).map((s) => (
            <button
              key={s || "all"}
              type="button"
              aria-pressed={reviewFilter === s}
              onClick={() => {
                setReviewFilter(s);
                setPage(0);
              }}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-semibold",
                reviewFilter === s
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-input bg-white",
              )}
            >
              {s ? ELIGIBILITY_LABEL[s] : "All"}
            </button>
          ))}
        </div>
        <Can permission={PERMISSION.REGISTRATION_APPROVE}>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus size={16} /> Register pet
          </Button>
        </Can>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="border-input focus-within:border-primary flex min-h-11 w-full max-w-md items-center gap-2 rounded-xl border bg-white px-3">
          <Search size={16} aria-hidden className="text-muted-foreground" />
          <input
            type="search"
            aria-label="Search registrations"
            placeholder="Pet, owner, bib or participant code"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={!filters.status}
            onChange={(e) => {
              setFilters((f) => ({
                ...f,
                status: e.target.checked ? "" : ENTRY_STATUS_LABEL.REGISTERED,
              }));
              setPage(0);
            }}
          />
          Show withdrawn
        </label>
        {summary && (
          <p className="text-muted-foreground text-sm">
            <b className="text-foreground">{summary.total}</b> registrations ·{" "}
            <b className="text-foreground">{summary.approved}</b> approved
          </p>
        )}
      </div>

      {entries.isError ? (
        <p role="alert" className="form-error">
          {entries.error instanceof Error
            ? entries.error.message
            : "Unable to load registrations."}
        </p>
      ) : (
        <DataTable
          label="Registrations"
          rows={entries.data?.items ?? []}
          columns={columns}
          filters={filters}
          onFilterChange={(key, value) => {
            setFilters((f) => ({ ...f, [key]: value }));
            setPage(0);
          }}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(0);
          }}
          server={{
            page,
            pageSize,
            total: entries.data?.meta.total ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(0);
            },
            loading: entries.isFetching,
          }}
          actions={(e) =>
            e.actions.approve || e.actions.reject || e.actions.markPaid ? (
              <>
                {e.actions.markPaid && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={markPaid.isPending}
                    onClick={() => pay(e)}
                    aria-label={`Mark ${petLabel(e)} as paid (simulation)`}
                    title="Simulation: there is no payment system yet"
                  >
                    Mark paid
                  </Button>
                )}
                {e.actions.approve && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => decide(e, "approve")}
                    aria-label={`Approve ${petLabel(e)}`}
                  >
                    <Check size={14} /> Approve
                  </Button>
                )}
                {e.actions.reject && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => setToReject(e)}
                    aria-label={`Reject ${petLabel(e)}`}
                    title="Reject"
                  >
                    <X size={16} />
                  </Button>
                )}
              </>
            ) : null
          }
        />
      )}

      <RegisterPetDrawer
        eventId={eventId}
        competitions={competitions.data ?? []}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      <ConfirmDialog
        open={!!toReject}
        onOpenChange={(open) => !open && setToReject(null)}
        title="Reject registration"
        description={`Reject ${toReject ? petLabel(toReject) : ""} (${toReject?.ownerName})? The owner will not be able to compete.`}
        confirmLabel="Reject"
        onConfirm={() => toReject && decide(toReject, "reject")}
      />
    </section>
  );
}
