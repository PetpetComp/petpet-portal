"use client";
import { toast } from "sonner";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOrganizationVerifications,
  useSubmitVerification,
} from "@/domains/organizations/queries";
import {
  VERIFICATION_TYPES,
  verificationTypeLabel,
  type OrganizationVerification,
} from "@/domains/organizations/types";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import { cn } from "@/lib/utils";

/** Label dan warna chip status verifikasi. Label teks selalu ikut. */
function statusChip(v: OrganizationVerification | undefined): {
  label: string;
  className: string;
} {
  if (!v)
    return { label: "Not submitted", className: "bg-muted text-primary-dark" };
  if (v.status === "VERIFIED")
    return { label: "Verified", className: "bg-done-soft text-done" };
  if (v.status === "REJECTED")
    return { label: "Rejected", className: "bg-danger-soft text-danger-ink" };
  return {
    label: "Pending review",
    className: "bg-warning-soft text-checkpoint",
  };
}

/**
 * Kartu "Verification" di tab Profile: satu baris per jenis (identity, legal document, bank
 * account, manual review) dengan status, alasan penolakan, dan tombol Submit/Resubmit untuk
 * OWNER. Ini verifikasi tambahan yang ditinjau super admin, terpisah dari badge Verified di
 * header (organisasi yang sudah disetujui). Hanya anggota yang boleh melihatnya.
 * Dipanggil dari `ProfileTab`.
 */
export function VerificationCard({
  organizationId,
}: {
  organizationId: string;
}) {
  const rights = useOrganizationRights(organizationId);
  const verifications = useOrganizationVerifications(
    organizationId,
    rights.canViewVerifications,
  );
  const submit = useSubmitVerification(organizationId);

  if (!rights.canViewVerifications) return null;

  function submitType(type: string) {
    submit.mutate(type, {
      onSuccess: () =>
        toast.success(`${verificationTypeLabel(type)} verification submitted`),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to submit.",
        ),
    });
  }

  return (
    <section
      aria-labelledby="verification-heading"
      className="border-border grid gap-3 rounded-2xl border bg-white p-5"
    >
      <div className="grid gap-1">
        <h2 id="verification-heading" className="text-base font-bold">
          Verification
        </h2>
        <p className="text-muted-foreground text-sm">
          Extra checks reviewed by a Petpet administrator. The owner submits
          each one.
        </p>
      </div>
      {verifications.isError ? (
        <ErrorState
          error={verifications.error}
          fallback="Unable to load verifications."
          onRetry={() => verifications.refetch()}
        />
      ) : verifications.isPending ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : (
        <ul>
          {VERIFICATION_TYPES.map((type) => {
            const v = verifications.data.find((item) => item.type === type);
            const chip = statusChip(v);
            const canSubmit =
              rights.canSubmitVerification && (!v || v.status === "REJECTED");
            return (
              <li
                key={type}
                className="border-muted flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3"
              >
                <span className="flex min-w-0 flex-1 basis-40 flex-col">
                  <b>{verificationTypeLabel(type)}</b>
                  {v?.status === "REJECTED" && v.rejectionReason && (
                    <span className="text-danger-ink text-[13px]">
                      {v.rejectionReason}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
                    chip.className,
                  )}
                >
                  {chip.label}
                </span>
                {canSubmit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-10"
                    disabled={submit.isPending}
                    aria-label={`${v ? "Resubmit" : "Submit"} ${verificationTypeLabel(type)} verification`}
                    onClick={() => submitType(type)}
                  >
                    {v ? "Resubmit" : "Submit"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
