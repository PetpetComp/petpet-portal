"use client";
import { useState } from "react";
import { Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { DataTable } from "@/components/common/data-table";
import { PageHeading } from "@/components/common/page-heading";
import { CompetitionContext } from "./competition-context";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
const criteria = ["Appearance", "Creativity", "Performance"];
export function ContestController({
  competition,
}: {
  competition: PortalRecord;
}) {
  const { data, save } = usePortalData();
  const pets = data.registrations
    .filter(
      (row) =>
        row.competitionId === competition.id &&
        row.paymentStatus === "Verified",
    )
    .flatMap((row) => {
      const pet = data.pets.find((pet) => pet.id === row.petId);
      return pet ? [pet] : [];
    });
  const [scores, setScores] = useState<Record<string, string>>(() =>
    competition.scores ? JSON.parse(competition.scores) : {},
  );
  const [saved, setSaved] = useState(false);
  const total = (id: string) =>
    criteria.reduce(
      (sum, criterion) => sum + Number(scores[id + criterion] || 0),
      0,
    );
  const valid =
    pets.length > 0 &&
    pets.every((pet) =>
      criteria.every((criterion) => {
        const score = scores[pet.id + criterion];
        return (
          score !== undefined &&
          score !== "" &&
          Number(score) >= 0 &&
          Number(score) <= 100
        );
      }),
    );
  return (
    <div className="page-stack">
      <CompetitionContext competition={competition} active="contest" />
      <PageHeading title="Contest Judging" />
      <div className="section-head">
        <h2>{competition.name}</h2>
        <span className="muted">
          Judge: Lifta Annisa / Maximum 100 per criterion
        </span>
      </div>
      <DataTable
        rows={pets}
        columns={[
          { key: "name", label: "Pet", value: (row) => row.name },
          ...criteria.map((criterion) => ({
            key: criterion,
            label: criterion,
            render: (row: PortalRecord) => (
              <Input
                aria-label={criterion + " for " + row.name}
                type="number"
                min={0}
                max={100}
                value={scores[row.id + criterion] ?? ""}
                onChange={(event) => {
                  setScores({
                    ...scores,
                    [row.id + criterion]: event.target.value,
                  });
                  setSaved(false);
                }}
              />
            ),
          })),
          { key: "total", label: "Total", value: (row) => total(row.id) },
        ]}
      />
      <div className="form-actions">
        <Button
          disabled={!valid || saved}
          onClick={() => {
            save("competitions", {
              ...competition,
              scores: JSON.stringify(scores),
              resultStatus: "Saved",
            });
            setSaved(true);
            toast.success("Judging scores saved");
          }}
        >
          <Save size={15} />
          {saved ? "Scores Saved" : "Save Scores"}
        </Button>
      </div>
      {saved && (
        <section>
          <div className="section-head">
            <h2>
              <Trophy size={18} /> Final Standings
            </h2>
          </div>
          <DataTable
            rows={[...pets].sort((a, b) => total(b.id) - total(a.id))}
            columns={[
              { key: "name", label: "Pet", value: (row) => row.name },
              {
                key: "score",
                label: "Total Score",
                value: (row) => total(row.id),
              },
            ]}
          />
        </section>
      )}
    </div>
  );
}
