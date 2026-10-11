"use client";
import Link from "next/link";
import { Play } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { useCompetitionTypes } from "@/domains/competitions/queries";
import { COMPETITION_STATUS_LABEL } from "@/domains/competitions/types";
import { ASSIGNMENTS_TEXT } from "@/domains/staff/constants";
import type { AssignmentCardData } from "@/domains/staff/my-assignments";
import { useLiveProgress } from "@/domains/staff/queries";
import { ROUTES } from "@/lib/constants/routes";

/**
 * Satu kartu penugasan: chip "tipe - peran", titik status, nama kompetisi, baris progres,
 * dan tombol besar ke Live Mode (desain Assignments). Dipanggil dari `assignments-page.tsx`.
 * `roleLabel` sudah diterjemahkan dari master peran oleh pemanggil.
 */
export function AssignmentCard({
  card,
  roleLabel,
}: {
  card: AssignmentCardData;
  roleLabel: string;
}) {
  const { competition } = card;
  const types = useCompetitionTypes();
  const progress = useLiveProgress(competition);
  const typeName = types.data?.find((t) => t.id === competition.typeId)?.name;
  const statusLabel = COMPETITION_STATUS_LABEL[competition.status];

  return (
    <li className="bg-brand grid gap-3 rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground min-w-0 truncate rounded-full bg-white px-3 py-1 text-xs font-bold">
          {typeName ? `${typeName} - ${roleLabel}` : roleLabel}
        </span>
        <StatusBadge status={statusLabel} />
      </div>
      <h3 className="font-display text-foreground text-2xl leading-tight break-words">
        {competition.name}
      </h3>
      <p className="text-primary-dark text-sm">{progress}</p>
      <Link
        href={ROUTES.live(competition.id)}
        className="bg-foreground flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold text-white"
      >
        <Play size={16} aria-hidden />
        {ASSIGNMENTS_TEXT.openLive}
      </Link>
    </li>
  );
}
