"use client";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { store, SUPERADMIN_EMAILS } from "@/lib/mocks/mock-store";

export interface Capabilities {
  isSuperAdmin: boolean;
  organizationIds: string[];
  isOrganizer: boolean;
  sponsorId: string | null;
  isSponsor: boolean;
}

const anonymous: Capabilities = {
  isSuperAdmin: false,
  organizationIds: [],
  isOrganizer: false,
  sponsorId: null,
  isSponsor: false,
};

export function useCapabilities(): Capabilities {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return anonymous;
    const isSuperAdmin = SUPERADMIN_EMAILS.includes(user.email.toLowerCase());
    const organizationIds = store.organizations
      .filter((org) => org.members.some((member) => member.user_uuid === user.id))
      .map((org) => org.uuid);
    const sponsor = store.sponsors.find((item) =>
      item.pics.some((pic) => pic.user_uuid === user.id),
    );
    return {
      isSuperAdmin,
      organizationIds,
      isOrganizer: organizationIds.length > 0,
      sponsorId: sponsor?.uuid ?? null,
      isSponsor: Boolean(sponsor),
    };
  }, [user]);
}
