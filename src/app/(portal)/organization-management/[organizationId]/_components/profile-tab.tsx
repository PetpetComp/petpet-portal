"use client";
import { useState } from "react";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/domains/organizations/queries";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import { VerifiedBadge } from "../../_components/organization-avatar";
import { EditProfileDrawer } from "./edit-profile-drawer";
import { VerificationCard } from "./verification-card";

/** Satu baris "label: nilai" di kartu profil; nilai kosong tampil "-". */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-muted grid gap-1 border-t py-3 sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-muted-foreground text-sm font-bold">{label}</dt>
      <dd className="break-words whitespace-pre-line">{value || "-"}</dd>
    </div>
  );
}

/**
 * Tab Profile: data organisasi (nama, email, telepon, alamat, deskripsi, status), tombol Edit
 * untuk OWNER/ADMIN (drawer), dan kartu verifikasi organisasi. Desain Org-Detail hanya memuat
 * nama tab. Dipanggil dari `profile/page`.
 */
export function ProfileTab({ organizationId }: { organizationId: string }) {
  const organization = useOrganization(organizationId);
  const rights = useOrganizationRights(organizationId);
  const [drawer, setDrawer] = useState({ open: false, key: 0 });

  if (organization.isError)
    return (
      <ErrorState
        error={organization.error}
        fallback="Unable to load the profile."
        onRetry={() => organization.refetch()}
      />
    );
  const org = organization.data;
  if (!org) return <Skeleton className="h-60 rounded-2xl" />;

  return (
    <section className="grid max-w-190 gap-5">
      <div className="border-border rounded-2xl border bg-white p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">Organization profile</h2>
          {rights.canEditProfile && (
            <Button
              variant="secondary"
              className="min-h-10"
              onClick={() => setDrawer((d) => ({ open: true, key: d.key + 1 }))}
            >
              Edit profile
            </Button>
          )}
        </div>
        <dl>
          <Row label="Name" value={org.name} />
          <Row label="Email" value={org.email} />
          <Row label="Phone" value={org.phone} />
          <Row label="Address" value={org.address} />
          <Row label="Description" value={org.description} />
          <div className="border-muted grid gap-1 border-t py-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <dt className="text-muted-foreground text-sm font-bold">Status</dt>
            <dd>{org.isVerified ? <VerifiedBadge /> : org.status}</dd>
          </div>
        </dl>
      </div>

      <VerificationCard organizationId={organizationId} />

      <EditProfileDrawer
        key={drawer.key}
        organization={org}
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
      />
    </section>
  );
}
