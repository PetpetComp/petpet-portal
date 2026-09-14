"use client";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { RaceController } from "./race-controller";
import { TimeTrialController } from "./time-trial-controller";
import { CompetitionDrawing } from "./competition-drawing";
import { ContestController } from "./contest-controller";
import Link from "next/link";
export function CompetitionView({ id, view }: { id: string; view: string }) {
  const { data } = usePortalData();
  const competition = data.competitions.find((item) => item.id === id);
  if (!competition)
    return (
      <div className="page-stack">
        <h1>Competition not found</h1>
        <Link href="/competition">Back to competitions</Link>
      </div>
    );
  if (view === "drawing")
    return <CompetitionDrawing key={id} competition={competition} />;
  if (view === "contest")
    return <ContestController key={id} competition={competition} />;
  if (view === "time-trial")
    return <TimeTrialController key={id} competition={competition} />;
  return <RaceController key={id} competition={competition} />;
}
