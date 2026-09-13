"use client";
import { useState } from "react";
import Link from "next/link";
import { Shuffle, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/data-table";
import { PageHeading } from "@/components/common/page-heading";
import { CompetitionContext } from "./competition-context";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
export function CompetitionDrawing({
  competition,
}: {
  competition: PortalRecord;
}) {
  const { data, save } = usePortalData();
  const eligible = data.registrations
    .filter(
      (row) =>
        row.competitionId === competition.id &&
        row.paymentStatus === "Verified",
    )
    .flatMap((row) => {
      const pet = data.pets.find((pet) => pet.id === row.petId);
      return pet ? [pet] : [];
    });
  const [order, setOrder] = useState<string[]>(() =>
    competition.drawing
      ? JSON.parse(competition.drawing)
      : eligible.map((pet) => pet.id),
  );
  const lanes = Math.max(1, Number(competition.lanes) || 4);
  const rows: PortalRecord[] = order.flatMap((id, index) => {
    const pet = eligible.find((pet) => pet.id === id);
    return pet
      ? [
          {
            ...pet,
            match: String(Math.floor(index / lanes) + 1),
            lane: String((index % lanes) + 1),
          },
        ]
      : [];
  });
  function shuffle() {
    const next = eligible.map((pet) => pet.id);
    for (let index = next.length - 1; index > 0; index--) {
      const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
      const target = Math.floor(random * (index + 1));
      [next[index], next[target]] = [next[target], next[index]];
    }
    setOrder(next);
  }
  return (
    <div className="page-stack">
      <CompetitionContext competition={competition} active="drawing" />
      <PageHeading
        title="Competition Drawing"
        actions={
          <Button
            variant="secondary"
            disabled={!eligible.length}
            onClick={shuffle}
          >
            <Shuffle size={15} />
            Regenerate Drawing
          </Button>
        }
      />
      <div className="race-summary">
        <div>
          <span>COMPETITION</span>
          <strong>{competition.name}</strong>
        </div>
        <div>
          <span>ELIGIBLE PARTICIPANTS</span>
          <strong>{eligible.length}</strong>
        </div>
        <div>
          <span>LANES</span>
          <strong>{lanes}</strong>
        </div>
        <div>
          <span>TOTAL MATCHES</span>
          <strong>{Math.ceil(eligible.length / lanes)}</strong>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "match", label: "Match", value: (row) => row.match },
          { key: "lane", label: "Lane", value: (row) => row.lane },
          { key: "name", label: "Pet", value: (row) => row.name },
          {
            key: "owner",
            label: "Owner",
            value: (row) =>
              data.users.find((user) => user.id === row.ownerUserId)?.name ??
              "-",
          },
        ]}
      />
      <div className="form-actions">
        <Button
          disabled={!rows.length}
          onClick={() => {
            save("competitions", {
              ...competition,
              drawing: JSON.stringify(order),
            });
            toast.success("Drawing saved");
          }}
        >
          <Save size={15} />
          Save Drawing
        </Button>
        <Link
          className="link-button secondary"
          href={
            "/competition/" +
            competition.id +
            "/" +
            (competition.type === "Contest"
              ? "contest"
              : competition.type === "Time Trial"
                ? "time-trial"
                : "run-match")
          }
        >
          <Play size={15} />
          Run Competition
        </Link>
      </div>
    </div>
  );
}
