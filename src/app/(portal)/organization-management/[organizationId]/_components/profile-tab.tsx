"use client";
import { useState } from "react";
import { ErrorState } from "@/components/common/error-state";
import {
  InfoList,
  PageColumns,
  SectionCard,
} from "@/components/common/page-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/domains/organizations/queries";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import { VerifiedBadge } from "../../_components/organization-avatar";
import { EditProfileDrawer } from "./edit-profile-drawer";
import { VerificationCard } from "./verification-card";

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

  const contact = [org.email, org.phone].filter(Boolean);
  return (
    <>
      <PageColumns
        main={
          <>
            <SectionCard
              title="Organization profile"
              action={
                rights.canEditProfile && (
                  <Button
                    variant="secondary"
                    className="min-h-10"
                    onClick={() =>
                      setDrawer((d) => ({ open: true, key: d.key + 1 }))
                    }
                  >
                    Edit profile
                  </Button>
                )
              }
            >
              <InfoList
                items={[
                  { label: "Name", value: org.name },
                  { label: "Email", value: org.email },
                  { label: "Phone", value: org.phone },
                  { label: "Address", value: org.address },
                ]}
              />
            </SectionCard>
            <SectionCard title="About">
              <p className="text-sm break-words whitespace-pre-line">
                {org.description || "-"}
              </p>
            </SectionCard>
            <VerificationCard organizationId={organizationId} />
          </>
        }
        aside={
          <SectionCard title="Summary">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground font-semibold">Status</dt>
                <dd>{org.isVerified ? <VerifiedBadge /> : org.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground font-semibold">Slug</dt>
                <dd className="font-medium break-all">{org.slug || "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground font-semibold">
                  Contact channels
                </dt>
                <dd className="font-medium">{contact.length} of 2</dd>
              </div>
            </dl>
          </SectionCard>
        }
      />

      <EditProfileDrawer
        key={drawer.key}
        organization={org}
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
      />
    </>
  );
}
