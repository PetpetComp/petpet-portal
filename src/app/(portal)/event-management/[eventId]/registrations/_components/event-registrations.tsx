"use client";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/common/can";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type Column } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { useEventEntries, useReviewEntry } from "@/domains/entries/queries";
import {
  ELIGIBILITY_STATUSES,
  PAYMENT_STATUSES,
  type EligibilityStatus,
  type Entry,
} from "@/domains/entries/types";
import { PERMISSION } from "@/lib/auth/permissions";
import { humanize, rupiah } from "@/lib/format/label";
import { cn } from "@/lib/utils";
import { RegisterPetDrawer } from "./register-pet-drawer";

/** Shown on a badge; "Pending" reads as "waiting for review" to the committee. */
const REVIEW_LABEL: Record<EligibilityStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function EventRegistrations({ eventId }: { eventId: string }) {
  const { competitions, entries } = useEventEntries(eventId);
  const review = useReviewEntry(eventId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toReject, setToReject] = useState<Entry | null>(null);
  const [reviewFilter, setReviewFilter] = useState<EligibilityStatus | "">("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const competitionName = (id: string) =>
    competitions.data?.find((c) => c.id === id)?.name ?? "-";
  const all = (entries.data ?? []).filter((e) => !e.withdrawn);
  const count = (s: EligibilityStatus) =>
    all.filter((e) => e.eligibility === s).length;
  const has = (value: string, filter = "") =>
    !filter || value.toLowerCase().includes(filter.toLowerCase());
  const rows = all.filter(
    (e) =>
      (!reviewFilter || e.eligibility === reviewFilter) &&
      has(e.petName, filters.pet) &&
      has(e.ownerName, filters.owner) &&
      (!filters.competition ||
        competitionName(e.competitionId) === filters.competition) &&
      (!filters.payment || humanize(e.payment) === filters.payment),
  );

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

  const columns: Column<Entry>[] = [
    {
      key: "pet",
      label: "Pet",
      value: (e) => e.petName,
      filter: { type: "text" },
      render: (e) => (
        <span>
          <b>{e.petName}</b>
          {e.bib && (
            <span className="text-muted-foreground block font-mono text-xs">
              #{e.bib}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      value: (e) => e.ownerName,
      filter: { type: "text" },
    },
    {
      key: "competition",
      label: "Competition",
      value: (e) => competitionName(e.competitionId),
      filter: {
        type: "select",
        options: (competitions.data ?? []).map((c) => c.name),
      },
    },
    {
      key: "fee",
      label: "Fee",
      value: (e) => e.fee,
      render: (e) => rupiah(e.fee),
    },
    {
      key: "payment",
      label: "Payment",
      value: (e) => humanize(e.payment),
      filter: { type: "select", options: PAYMENT_STATUSES.map(humanize) },
      render: (e) => <StatusBadge status={humanize(e.payment)} />,
    },
    {
      key: "review",
      label: "Review",
      value: (e) => REVIEW_LABEL[e.eligibility],
      render: (e) => <StatusBadge status={REVIEW_LABEL[e.eligibility]} />,
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
              onClick={() => setReviewFilter(s)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-semibold",
                reviewFilter === s
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-input bg-white",
              )}
            >
              {s ? REVIEW_LABEL[s] : "All"}{" "}
              <span className="font-mono">{s ? count(s) : all.length}</span>
            </button>
          ))}
        </div>
        <Can permission={PERMISSION.REGISTRATION_APPROVE}>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus size={16} /> Register pet
          </Button>
        </Can>
      </div>

      {entries.isError || competitions.isError ? (
        <p role="alert" className="form-error">
          {((entries.error ?? competitions.error) as Error | null)?.message ??
            "Unable to load registrations."}
        </p>
      ) : (
        <DataTable
          label="Registrations"
          rows={rows}
          columns={columns}
          filters={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
          actions={(e) =>
            e.eligibility === "PENDING" ? (
              <Can permission={PERMISSION.REGISTRATION_APPROVE}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => decide(e, "approve")}
                  aria-label={`Approve ${e.petName}`}
                >
                  <Check size={14} /> Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => setToReject(e)}
                  aria-label={`Reject ${e.petName}`}
                >
                  <X size={14} /> Reject
                </Button>
              </Can>
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
        description={`Reject ${toReject?.petName} (${toReject?.ownerName})? The owner will not be able to compete.`}
        confirmLabel="Reject"
        onConfirm={() => toReject && decide(toReject, "reject")}
      />
    </section>
  );
}
