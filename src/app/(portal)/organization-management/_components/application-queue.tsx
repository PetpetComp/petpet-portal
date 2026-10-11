"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveApplication,
  useRejectApplication,
  useWaitingApplications,
} from "@/domains/organizations/queries";
import {
  applicationStatusLabel,
  type OrganizerApplication,
} from "@/domains/organizations/types";
import { RejectDrawer } from "./reject-drawer";

/** Yang sedang ditolak: pengajuannya, dan `key` supaya isian drawer mulai bersih. */
type Rejecting = { application: OrganizerApplication; key: number };

/** "Applied by Sari Wulandari . Jl. Ahmad Yani"; bagian yang kosong dilewati. */
function appliedByText(application: OrganizerApplication): string {
  const who = application.applicantName ?? application.contactEmail;
  return ["Applied by " + who, application.address].filter(Boolean).join(" · ");
}

/**
 * Antrean pengajuan organizer untuk pemegang `organization.verify` (desain Orgs, kolom
 * "Applications"): kartu "Waiting for review" dengan Approve dan Reject. Reject membuka drawer
 * yang meminta alasan (wajib di backend). Approve membuat organisasi dan menjadikan pengaju owner.
 * Dipanggil dari `ApplicationsPanel`.
 */
export function ApplicationQueue() {
  const waiting = useWaitingApplications(true);
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const [rejecting, setRejecting] = useState<Rejecting | null>(null);
  const [drawerKey, setDrawerKey] = useState(0);

  function approveOne(application: OrganizerApplication) {
    approve.mutate(application.id, {
      onSuccess: () =>
        toast.success(`${application.organizationName} approved`),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to approve.",
        ),
    });
  }

  function rejectOne(note: string) {
    if (!rejecting) return;
    const { application } = rejecting;
    reject.mutate(
      { id: application.id, note },
      {
        onSuccess: () => {
          toast.success(`${application.organizationName} rejected`);
          setRejecting(null);
        },
        onError: (cause) =>
          toast.error(
            cause instanceof Error ? cause.message : "Unable to reject.",
          ),
      },
    );
  }

  if (waiting.isError)
    return (
      <ErrorState
        error={waiting.error}
        fallback="Unable to load applications."
        onRetry={() => waiting.refetch()}
      />
    );
  if (waiting.isPending) return <Skeleton className="h-36 rounded-2xl" />;

  const items = waiting.data;
  return (
    <div className="grid gap-3">
      {items.length === 0 && (
        <p className="border-border text-muted-foreground rounded-2xl border bg-white p-5">
          No applications are waiting for review.
        </p>
      )}
      {items.map((application) => {
        const busy = approve.isPending && approve.variables === application.id;
        return (
          <article
            key={application.id}
            className="border-primary grid gap-3 rounded-2xl border-2 bg-white p-4.5"
          >
            <span className="bg-warning-soft text-event-day-ink w-fit rounded-full px-2.5 py-0.5 text-xs font-bold">
              {applicationStatusLabel(application.status)}
            </span>
            <b className="text-lg break-words">
              {application.organizationName}
            </b>
            <span className="text-muted-foreground break-words">
              {appliedByText(application)}
            </span>
            <div className="flex gap-2">
              <Button
                className="bg-done hover:bg-done min-h-11 flex-1 rounded-xl font-bold hover:brightness-110"
                disabled={busy}
                aria-label={`Approve ${application.organizationName}`}
                onClick={() => approveOne(application)}
              >
                {busy ? "Approving..." : "Approve"}
              </Button>
              <Button
                variant="secondary"
                className="min-h-11 flex-1 rounded-xl font-bold"
                aria-label={`Reject ${application.organizationName}`}
                onClick={() => {
                  setDrawerKey((k) => k + 1);
                  setRejecting({ application, key: drawerKey + 1 });
                }}
              >
                Reject
              </Button>
            </div>
          </article>
        );
      })}
      <p className="text-muted-foreground leading-5">
        Approving creates the organization and makes the applicant its owner.
      </p>

      {rejecting && (
        <RejectDrawer
          key={rejecting.key}
          open
          onOpenChange={(open) => !open && setRejecting(null)}
          title="Reject application"
          description={`Tell ${rejecting.application.applicantName ?? "the applicant"} why ${rejecting.application.organizationName} was not approved.`}
          label="Reason"
          submitLabel="Reject application"
          pending={reject.isPending}
          onSubmit={rejectOne}
        />
      )}
    </div>
  );
}
