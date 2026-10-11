"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canApplyAsOrganizer,
  canCancelApplication,
} from "@/domains/organizations/access";
import {
  useCancelApplication,
  useMyApplications,
} from "@/domains/organizations/queries";
import {
  applicationStatusLabel,
  isOpenApplication,
  type OrganizerApplication,
} from "@/domains/organizations/types";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { ApplyDrawer } from "./apply-drawer";

/** Warna badge status pengajuan. Label teks selalu ikut. */
function statusBadgeClass(status: string): string {
  if (status === "APPROVED") return "bg-done-soft text-done";
  if (status === "REJECTED") return "bg-danger-soft text-danger-ink";
  if (isOpenApplication({ status }))
    return "bg-warning-soft text-event-day-ink";
  return "bg-muted text-primary-dark";
}

/**
 * Kolom "Applications" untuk akun tanpa hak meninjau: pengajuan terakhir milik sendiri
 * (status, alasan penolakan, batalkan) dan tombol "Apply as organizer" bila belum ada pengajuan
 * terbuka. Pengajuan APPROVED menawarkan "Refresh my access" karena keanggotaan dibaca saat login.
 * Dipanggil dari `ApplicationsPanel`.
 */
export function MyApplicationSection() {
  const mine = useMyApplications();
  const cancel = useCancelApplication();
  const { user, memberships, refreshSession } = useAuth();
  const [drawerKey, setDrawerKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cancelling, setCancelling] = useState<OrganizerApplication | null>(
    null,
  );

  if (mine.isError)
    return (
      <ErrorState
        error={mine.error}
        fallback="Unable to load your application."
        onRetry={() => mine.refetch()}
      />
    );
  if (mine.isPending) return <Skeleton className="h-36 rounded-2xl" />;

  const latest: OrganizerApplication | undefined = mine.data[0];
  const canApply = canApplyAsOrganizer(mine.data);
  const isMember =
    latest?.approvedOrganizationId != null &&
    memberships.some((m) => m.organizationId === latest.approvedOrganizationId);

  function openDrawer() {
    setDrawerKey((k) => k + 1);
    setDrawerOpen(true);
  }

  function confirmCancel() {
    if (!cancelling) return;
    cancel.mutate(cancelling.id, {
      onSuccess: () => toast.success("Application cancelled"),
      onError: (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Unable to cancel.",
        ),
    });
  }

  return (
    <div className="grid gap-3">
      {latest ? (
        <article className="border-border grid gap-3 rounded-2xl border bg-white p-4.5">
          <span
            className={cn(
              "w-fit rounded-full px-2.5 py-0.5 text-xs font-bold",
              statusBadgeClass(latest.status),
            )}
          >
            {applicationStatusLabel(latest.status)}
          </span>
          <b className="text-lg break-words">{latest.organizationName}</b>
          {latest.status === "REJECTED" && latest.reviewNote && (
            <p className="text-muted-foreground">Reason: {latest.reviewNote}</p>
          )}
          {isOpenApplication(latest) && (
            <p className="text-muted-foreground">
              A Petpet administrator is reviewing your application.
            </p>
          )}
          {latest.status === "APPROVED" && (
            <p className="text-muted-foreground">
              Your organization is ready. You are its owner.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {latest.status === "APPROVED" && latest.approvedOrganizationId && (
              <Link
                href={ROUTES.organizations.detail(
                  latest.approvedOrganizationId,
                )}
                className={cn(
                  buttonVariants(),
                  "min-h-11 rounded-xl font-bold",
                )}
              >
                Open organization
              </Link>
            )}
            {latest.status === "APPROVED" && !isMember && (
              <Button
                variant="secondary"
                className="min-h-11 rounded-xl font-bold"
                onClick={() => void refreshSession()}
              >
                Refresh my access
              </Button>
            )}
            {canCancelApplication(latest) && (
              <Button
                variant="secondary"
                className="min-h-11 rounded-xl font-bold"
                onClick={() => setCancelling(latest)}
              >
                Cancel application
              </Button>
            )}
          </div>
        </article>
      ) : (
        <p className="border-border text-muted-foreground rounded-2xl border bg-white p-5 leading-5">
          Want to run events on Petpet? Apply as an organizer. Once a Petpet
          administrator approves, your organization is created and you become
          its owner.
        </p>
      )}

      {canApply && (
        <Button className="min-h-11 rounded-xl font-bold" onClick={openDrawer}>
          Apply as organizer
        </Button>
      )}

      <ApplyDrawer
        key={drawerKey}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        defaultEmail={user?.email ?? ""}
      />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel application"
        description={`Cancel your application for ${cancelling?.organizationName ?? "this organization"}? You can apply again later.`}
        confirmLabel="Cancel application"
        onConfirm={confirmCancel}
      />
    </div>
  );
}
