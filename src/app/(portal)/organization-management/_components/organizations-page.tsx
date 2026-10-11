"use client";
import Link from "next/link";
import { ListPageHeader } from "@/components/common/list-page-header";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { canReviewApplications } from "@/domains/organizations/access";
import { useAccessProfile } from "@/domains/organizations/use-organization-rights";
import { ApplicationQueue } from "./application-queue";
import { MyApplicationSection } from "./my-application-section";
import { VerificationQueue } from "./verification-queue";
import { VerifiedOrganizations } from "./verified-organizations";

/**
 * Halaman daftar organisasi (`/organization-management`), sesuai desain Orgs: kartu
 * "Verified organizers" di kiri, kolom "Applications" di kanan. Isi kolom kanan mengikuti hak:
 * pemegang `organization.verify` melihat antrean pengajuan dan verifikasi, akun lain melihat
 * pengajuan sendiri dan tombol "Apply as organizer" (alur onboarding organizer). Tombol
 * "New organization" di header hanya untuk pemegang `organization.verify` (buat langsung).
 * Dipanggil dari `page.tsx`.
 */
export function OrganizationsPage() {
  const reviewer = canReviewApplications(useAccessProfile());
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <ListPageHeader
        title="Organizations"
        description="Organizers that run events. New organizers apply and are approved here."
        action={
          reviewer && (
            <Link
              href={ROUTES.organizations.create}
              className={cn(buttonVariants(), "min-h-11 rounded-xl font-bold")}
            >
              New organization
            </Link>
          )
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <VerifiedOrganizations />
        <aside className="grid min-w-0 gap-3">
          <h2 className="text-base font-bold">Applications</h2>
          {reviewer ? (
            <>
              <ApplicationQueue />
              <VerificationQueue />
            </>
          ) : (
            <MyApplicationSection />
          )}
        </aside>
      </div>
    </div>
  );
}
