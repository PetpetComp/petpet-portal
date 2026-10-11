"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useApproveVerification,
  useOrganizations,
  usePendingVerifications,
  useRejectVerification,
} from "@/domains/organizations/queries";
import {
  verificationTypeLabel,
  type OrganizationVerification,
} from "@/domains/organizations/types";
import { RejectDrawer } from "./reject-drawer";

/**
 * Antrean "Verification requests" untuk pemegang `organization.verify`: permintaan verifikasi
 * organisasi (identity, legal document, ...) yang masih PENDING, dengan Approve dan Reject
 * (alasan wajib). Desain Orgs tidak punya bagian ini; ditaruh di bawah antrean pengajuan.
 * Nama organisasi diambil dari response bila ada, kalau tidak dicari di daftar organisasi
 * (backend belum mengirim `organization_name`, doc 09). Dipanggil dari `ApplicationsPanel`.
 */
export function VerificationQueue() {
  const queue = usePendingVerifications(true);
  const organizations = useOrganizations();
  const approve = useApproveVerification();
  const reject = useRejectVerification();
  const [rejecting, setRejecting] = useState<OrganizationVerification | null>(
    null,
  );

  const nameOf = (v: OrganizationVerification) =>
    v.organizationName ??
    organizations.data?.find((o) => o.id === v.organizationId)?.name ??
    "Organization";

  function approveOne(v: OrganizationVerification) {
    approve.mutate(v.id, {
      onSuccess: () => toast.success("Verification approved"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to approve.",
        ),
    });
  }

  function rejectOne(reason: string) {
    if (!rejecting) return;
    reject.mutate(
      { id: rejecting.id, reason },
      {
        onSuccess: () => {
          toast.success("Verification rejected");
          setRejecting(null);
        },
        onError: (cause) =>
          toast.error(
            cause instanceof Error ? cause.message : "Unable to reject.",
          ),
      },
    );
  }

  if (queue.isError)
    return (
      <p role="alert" className="text-danger-ink text-sm font-semibold">
        Verification requests could not be loaded.
      </p>
    );

  const items = queue.data ?? [];
  return (
    <section className="grid gap-3" aria-label="Verification requests">
      <b className="text-base">Verification requests</b>
      {!queue.isPending && items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No verification requests are waiting.
        </p>
      )}
      {items.map((v) => (
        <article
          key={v.id}
          className="border-border grid gap-2 rounded-2xl border bg-white p-4"
        >
          <b className="break-words">{nameOf(v)}</b>
          <span className="text-muted-foreground text-sm">
            {verificationTypeLabel(v.type)} verification
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-done hover:bg-done min-h-10 flex-1 hover:brightness-110"
              disabled={approve.isPending && approve.variables === v.id}
              aria-label={`Approve ${verificationTypeLabel(v.type)} verification of ${nameOf(v)}`}
              onClick={() => approveOne(v)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="min-h-10 flex-1"
              aria-label={`Reject ${verificationTypeLabel(v.type)} verification of ${nameOf(v)}`}
              onClick={() => setRejecting(v)}
            >
              Reject
            </Button>
          </div>
        </article>
      ))}

      {rejecting && (
        <RejectDrawer
          key={rejecting.id}
          open
          onOpenChange={(open) => !open && setRejecting(null)}
          title="Reject verification"
          description={`Explain why the ${verificationTypeLabel(rejecting.type)} verification of ${nameOf(rejecting)} is rejected. The owner can submit it again.`}
          label="Reason"
          submitLabel="Reject verification"
          pending={reject.isPending}
          onSubmit={rejectOne}
        />
      )}
    </section>
  );
}
