"use client";
import { useState } from "react";
import Link from "next/link";
import { Shuffle, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeading } from "@/components/common/page-heading";
import { CompetitionContext } from "./competition-context";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
import { buildInitialBracket, isRoundComplete, parseBracket, shuffleIds } from "../_lib/race-bracket";
import { runPathFor } from "@/app/(portal)/event-management/[eventId]/competitions/_lib/competition-rules";

export function CompetitionDrawing({ competition }: { competition: PortalRecord }) {
  const { data, save } = usePortalData();
  const [closeOpen, setCloseOpen] = useState(false);
  const eligible = data.registrations
    .filter((row) => row.competitionId === competition.id && row.paymentStatus === "Verified")
    .flatMap((row) => {
      const pet = data.pets.find((item) => item.id === row.petId);
      return pet ? [pet] : [];
    });
  const lanes = Math.max(1, Number(competition.lanes) || 4);
  const bracket = parseBracket(competition.raceBracket, eligible.map((pet) => pet.id), lanes);
  const currentRound = bracket.rounds[bracket.rounds.length - 1] ?? [];
  const canRegenerate = bracket.rounds.length === 1 && bracket.rounds[0].every((match) => !match.confirmed);
  const isFinished = currentRound[0]?.type === "Final" && isRoundComplete(currentRound);

  function regenerate() {
    const next = buildInitialBracket(shuffleIds(eligible.map((pet) => pet.id)), lanes);
    save("competitions", { ...competition, raceBracket: JSON.stringify(next) });
    toast.success("Drawing regenerated");
  }

  return (
    <div className="page-stack">
      <CompetitionContext competition={competition} active="drawing" />
      <div className="pet-detail-header">
        <PageHeading title="Competition Drawing" description="Round 1 participant lane assignment." />
        <div className="row-actions">
          <Link
            className="link-button"
            href={
              "/competition/" +
              competition.id +
              "/" +
              runPathFor(competition.type)
            }
          >
            <Play size={15} />
            Run Match
          </Link>
          <Button variant="secondary" disabled={!canRegenerate} onClick={regenerate}>
            <Shuffle size={15} />
            Regenerate Drawing
          </Button>
          {isFinished && (
            <Button variant="destructive" onClick={() => setCloseOpen(true)}>
              <XCircle size={15} />
              Close Competition
            </Button>
          )}
        </div>
      </div>
      <p className="assignment-note">
        Only participants with <strong>Verified</strong> payment status are
        eligible for drawing.
      </p>
      <section className="form-section pet-detail-card">
        <div className="eyebrow">EVENT INFORMATION</div>
        <dl className="detail-grid">
          <div>
            <dt>Competition</dt>
            <dd>{competition.name}</dd>
          </div>
          <div>
            <dt>Competition Type</dt>
            <dd>{competition.type}</dd>
          </div>
          <div>
            <dt>Total Participants</dt>
            <dd>{eligible.length}</dd>
          </div>
          <div>
            <dt>Lane</dt>
            <dd>{lanes}</dd>
          </div>
          <div>
            <dt>Total Match</dt>
            <dd>{currentRound.length}</dd>
          </div>
          <div>
            <dt>Current Round</dt>
            <dd>{bracket.rounds.length}</dd>
          </div>
        </dl>
      </section>
      <section className="form-section pet-detail-card">
        <div className="eyebrow">RACE OPERATION</div>
        <h2>Drawing &amp; Round Progression</h2>
        <p className="muted">
          Drawing results, confirmed match results, and round progression are
          managed from the Run Match page.
        </p>
        <div className="form-actions">
          <Link
            className="link-button"
            href={
              "/competition/" +
              competition.id +
              "/" +
              runPathFor(competition.type)
            }
          >
            Open Run Match
          </Link>
        </div>
      </section>
      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close this competition?"
        description="The competition will be marked as closed once the final round is confirmed."
        confirmLabel="Close Competition"
        onConfirm={() => {
          save("competitions", { ...competition, raceStatus: "Closed" });
          toast.success("Competition closed");
        }}
      />
    </div>
  );
}
