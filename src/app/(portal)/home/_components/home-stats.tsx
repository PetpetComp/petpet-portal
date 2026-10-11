"use client";
import Link from "next/link";
import {
  useOrganizationsCount,
  usePendingApplicationsCount,
} from "@/domains/organizations/queries";
import { useUsersCount } from "@/domains/users/queries";
import { ROUTES } from "@/lib/constants/routes";

/** Nilai kartu statistik: "-" bila gagal dimuat, "..." selama memuat. */
const show = (q: { data?: number; isError: boolean }) =>
  q.isError ? "-" : (q.data ?? "...");

/**
 * Baris statistik singkat. Semua orang melihat event hari ini dan "Coming up" (dari jadwal
 * yang sudah dimuat); super admin menambah angka platform (hook count yang sudah ada).
 * Dipanggil dari `organizer-home.tsx`.
 */
export function HomeStats({
  eventsToday,
  upcomingTotal,
  isAdmin,
}: {
  eventsToday: number;
  upcomingTotal: number;
  isAdmin: boolean;
}) {
  return (
    <section
      aria-label="Quick stats"
      className="grid [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] gap-3"
    >
      <Stat label="Events today" value={eventsToday} />
      <Stat label="Coming up" value={upcomingTotal} />
      {isAdmin && <AdminStats />}
    </section>
  );
}

/** Angka platform untuk super admin. Hook count hanya jalan bila komponen ini dirender. */
function AdminStats() {
  const pending = usePendingApplicationsCount(true);
  const users = useUsersCount(true);
  const organizations = useOrganizationsCount(true);
  return (
    <>
      <Stat
        label="Organizer applications"
        value={show(pending)}
        href={ROUTES.organizationManagement}
      />
      <Stat label="Users" value={show(users)} />
      <Stat label="Organizations" value={show(organizations)} />
    </>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-muted-foreground text-sm font-semibold">
        {label}
      </span>
      <b className="font-mono text-3xl font-semibold">{value}</b>
    </>
  );
  const className =
    "border-border grid min-w-0 gap-1 rounded-2xl border bg-white p-5";
  return href ? (
    <Link href={href} className={`${className} hover:border-primary`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
