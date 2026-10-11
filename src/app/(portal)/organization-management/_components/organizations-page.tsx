"use client";
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
 * pengajuan sendiri dan tombol "Apply as organizer" (alur onboarding organizer).
 * Dipanggil dari `page.tsx`.
 */
export function OrganizationsPage() {
  const reviewer = canReviewApplications(useAccessProfile());
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <header className="grid gap-1.5">
        <h1 className="font-display text-[34px] leading-[38px] font-bold">
          Organizations
        </h1>
        <p className="text-muted-foreground text-[15px]">
          Organizers that run events. New organizers apply and are approved
          here.
        </p>
      </header>
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
