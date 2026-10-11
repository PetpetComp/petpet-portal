"use client";
import { useMemo } from "react";
import { useEventSponsorTeam } from "@/domains/sponsors/queries";
import { groupByLevel } from "@/domains/sponsors/types";

/**
 * Strip "SUPPORTED BY" di dasar Live Mode: sponsor event diurutkan menurut tier
 * (Platinum dulu), digabung dengan nama brand seperti tab Sponsors. Tidak menampilkan
 * apa pun saat data belum siap, gagal dimuat, atau event belum punya sponsor.
 */
export function LiveSponsorStrip({ eventId }: { eventId: string }) {
  const { sponsors } = useEventSponsorTeam(eventId);
  const ordered = useMemo(
    () => groupByLevel(sponsors ?? []).flatMap((group) => group.sponsors),
    [sponsors],
  );
  if (ordered.length === 0) return null;
  return (
    <footer
      aria-label="Sponsors"
      className="border-border bg-card flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 md:px-7"
    >
      <span className="text-muted-foreground text-[11px] font-bold tracking-widest">
        SUPPORTED BY
      </span>
      <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-1">
        {ordered.map((sponsor) => (
          <li
            key={sponsor.linkId}
            className="text-primary-dark text-sm font-semibold"
          >
            {sponsor.brandName}
          </li>
        ))}
      </ul>
    </footer>
  );
}
