"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ErrorState } from "@/components/common/error-state";
import { TabNav, type TabNavItem } from "@/components/common/tab-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvents } from "@/domains/events/queries";
import { useOrganization } from "@/domains/organizations/queries";
import { useOrganizationRights } from "@/domains/organizations/use-organization-rights";
import { ROUTES } from "@/lib/constants/routes";
import {
  OrganizationAvatar,
  VerifiedBadge,
} from "../../_components/organization-avatar";
import { InviteMemberDrawer } from "./invite-member-drawer";

/** Empat tab detail organisasi (desain Org-Detail). Members aktif hanya di alamat dasar. */
export function organizationTabs(organizationId: string): TabNavItem[] {
  return [
    {
      label: "Members",
      href: ROUTES.organizations.detail(organizationId),
      exact: true,
    },
    { label: "Events", href: ROUTES.organizations.events(organizationId) },
    {
      label: "Pending invitations",
      href: ROUTES.organizations.invitations(organizationId),
    },
    { label: "Profile", href: ROUTES.organizations.profile(organizationId) },
  ];
}

/**
 * Teks di bawah nama: "Organizer of {event pertama}" ditambah "and N more" bila lebih dari satu,
 * atau "No events yet". Dihitung dari satu halaman kecil `GET /events?organization_id=`.
 */
export function organizerOfText(eventNames: string[], total: number): string {
  if (total === 0 || eventNames.length === 0) return "No events yet";
  const more = total - 1;
  return more > 0
    ? `Organizer of ${eventNames[0]} and ${more} more`
    : `Organizer of ${eventNames[0]}`;
}

/**
 * Header + tab yang dipakai semua halaman detail organisasi (layout `[organizationId]/(workspace)`):
 * breadcrumb, inisial, nama, badge Verified, "Organizer of ...", tombol Invite member
 * (hanya bila hak undang), dan bar tab. Dipanggil dari layout.
 */
export function OrganizationShell({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  const organization = useOrganization(organizationId);
  const events = useEvents({
    organizationId,
    page: 1,
    perPage: 1,
  });
  const rights = useOrganizationRights(organizationId);
  const [invite, setInvite] = useState({ open: false, key: 0 });

  if (organization.isError)
    return (
      <div className="grid gap-4">
        <ErrorState
          error={organization.error}
          fallback="Unable to load this organization."
          onRetry={() => organization.refetch()}
        />
        <Link
          href={ROUTES.organizationManagement}
          className="text-primary font-semibold"
        >
          Back to organizations
        </Link>
      </div>
    );

  const org = organization.data;
  const subtitle = events.data
    ? organizerOfText(
        events.data.items.map((e) => e.name),
        events.data.meta.total,
      )
    : null;

  return (
    <div className="grid gap-4.5">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex items-center gap-2"
      >
        <Link
          href={ROUTES.organizationManagement}
          className="text-primary font-semibold"
        >
          Organizations
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-foreground font-semibold">
          {org?.name ?? "Loading..."}
        </span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {org ? (
            <OrganizationAvatar name={org.name} size="lg" />
          ) : (
            <Skeleton className="size-15 shrink-0 rounded-2xl" />
          )}
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[30px] leading-8.5 font-semibold wrap-break-word">
                {org?.name ?? "Loading organization..."}
              </h1>
              {org?.isVerified && <VerifiedBadge />}
            </div>
            {subtitle ? (
              <p className="text-muted-foreground">{subtitle}</p>
            ) : (
              <Skeleton className="h-4 w-64 max-w-full" />
            )}
          </div>
        </div>
        {rights.canInvite && org && (
          <Button
            className="min-h-11 rounded-xl font-bold"
            onClick={() => setInvite((s) => ({ open: true, key: s.key + 1 }))}
          >
            Invite member
          </Button>
        )}
      </header>

      <TabNav
        label="Organization sections"
        items={organizationTabs(organizationId)}
      />

      <div className="mt-1.5 grid min-w-0 gap-5">{children}</div>

      {org && (
        <InviteMemberDrawer
          key={invite.key}
          organizationId={organizationId}
          organizationName={org.name}
          open={invite.open}
          onOpenChange={(open) => setInvite((s) => ({ ...s, open }))}
        />
      )}
    </div>
  );
}
