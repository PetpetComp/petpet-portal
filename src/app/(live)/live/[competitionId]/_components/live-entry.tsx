"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import { ROUTES } from "@/lib/constants/routes";
import { liveVariantOf } from "./live-family";

/**
 * Pintu masuk `/live/[competitionId]`. Dipanggil dari `page.tsx`. Menunggu tipe kompetisi, lalu
 * mengganti rute ke langkah pertama keluarganya: Contest -> /judging; Race dan Time trial ->
 * /drawing. Error kompetisi ditampilkan oleh LiveShell; bila hanya daftar tipe yang gagal, jatuh
 * ke /drawing (layar itu menampilkan errornya sendiri).
 */
export function LiveEntry({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const ready =
    Boolean(competition.data) && (Boolean(types.data) || types.isError);
  const code = types.data?.find((t) => t.id === competition.data?.typeId)?.code;
  const variant = liveVariantOf(code);

  useEffect(() => {
    if (!ready) return;
    router.replace(
      variant === "contest"
        ? ROUTES.liveJudging(competitionId)
        : ROUTES.liveDrawing(competitionId),
    );
  }, [ready, variant, competitionId, router]);

  return (
    <div className="grid gap-4 p-4 md:p-7" aria-busy>
      <Skeleton className="h-24 w-full max-w-sm" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
