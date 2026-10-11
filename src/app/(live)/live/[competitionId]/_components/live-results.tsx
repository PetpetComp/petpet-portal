"use client";
import { CompetitionResults } from "@/app/(portal)/event-management/[eventId]/competitions/[competitionId]/_components/results/competition-results";

/**
 * Tab Results Live Mode (langkah 3). Dipanggil dari `results/page.tsx`.
 * Memakai ulang komponen Results workspace kompetisi (podium dan klasemen), yang hanya butuh
 * `competitionId` (kompetisi dan tipenya dimuat sendiri). Klasemen dibangun dari match yang
 * sudah di-Confirm (kontrak 13 bagian 13, aturan 17).
 */
export function LiveResults({ competitionId }: { competitionId: string }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-4 p-4 md:p-7">
      <h2 className="font-display text-2xl font-bold">Results</h2>
      <CompetitionResults competitionId={competitionId} />
    </div>
  );
}
