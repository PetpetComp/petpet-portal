"use client";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Competition } from "@/domains/competitions/types";
import { useLiveProgress } from "@/domains/staff/queries";
import { ROUTES } from "@/lib/constants/routes";
import { HOME_TEXT } from "../_lib/home-text";

/**
 * Kartu "Live now" untuk satu kompetisi ONGOING (desain Home): nama, event, baris progres,
 * dan tombol ke Live Mode (`ROUTES.live`). Dipanggil dari `today-event.tsx`.
 */
export function LiveNowCard({
  competition,
  eventName,
}: {
  competition: Competition;
  eventName: string;
}) {
  const progress = useLiveProgress(competition);
  return (
    <section
      aria-label={`${HOME_TEXT.liveNow}: ${competition.name}`}
      className="bg-brand flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
    >
      <div className="min-w-0">
        <span className="text-primary-dark flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
          <span className="bg-primary size-2 rounded-full" aria-hidden />
          {HOME_TEXT.liveNow}
        </span>
        <h2 className="font-display text-2xl break-words">
          {competition.name}
        </h2>
        <p className="text-primary-dark text-sm">
          {eventName} - {progress}
        </p>
      </div>
      <Link
        href={ROUTES.live(competition.id)}
        className="bg-foreground inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white"
      >
        <Play size={14} aria-hidden />
        {HOME_TEXT.openLive}
      </Link>
    </section>
  );
}
