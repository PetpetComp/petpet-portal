"use client";
import { useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { DataTable, type Column } from "@/components/common/data-table";
import { PageHeading } from "@/components/common/page-heading";
import { CompetitionContext } from "./competition-context";
import { EventPartners } from "./event-partners";
import { usePortalData } from "@/components/providers/portal-data-provider";
import type { PortalRecord } from "@/types/portal";
import { parseContestCriteria } from "@/app/(portal)/event-management/[eventId]/competitions/_lib/competition-rules";
import {
  STATUS_LABEL,
  STATUS_TONE,
  assessmentFor,
  isReadyToComplete,
  parseAssessments,
  totalScore,
  type Assessment,
  type ParticipantStatus,
} from "@/app/(portal)/competition/[competitionId]/contest/_lib/contest-rules";

export function ContestController({ competition }: { competition: PortalRecord }) {
  const { data, save } = usePortalData();
  const criteria = parseContestCriteria(competition.contestCriteria);
  const totalMaxScore = criteria.reduce((sum, item) => sum + item.maxPoints, 0);
  const [assessments, setAssessments] = useState<Record<string, Assessment>>(() =>
    parseAssessments(competition.contestAssessments),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const participants = data.registrations
    .filter((row) => row.competitionId === competition.id && row.paymentStatus === "Verified")
    .flatMap((row) => {
      const pet = data.pets.find((item) => item.id === row.petId);
      const owner = data.users.find((item) => item.id === row.userId);
      return pet ? [{ pet, owner }] : [];
    });

  const completedCount = participants.filter(
    (item) => assessmentFor(assessments, item.pet.id).status === "completed",
  ).length;

  function persist(next: Record<string, Assessment>) {
    setAssessments(next);
    save("competitions", { ...competition, contestAssessments: JSON.stringify(next) });
  }

  function updateAssessment(petId: string, patch: Partial<Assessment>) {
    const current = assessmentFor(assessments, petId);
    persist({ ...assessments, [petId]: { ...current, ...patch, updatedAt: new Date().toISOString() } });
  }

  function setStatus(petId: string, status: ParticipantStatus) {
    updateAssessment(petId, { status });
  }

  const rows = participants
    .map((item, index) => ({
      order: index + 1,
      pet: item.pet,
      owner: item.owner,
      assessment: assessmentFor(assessments, item.pet.id),
    }))
    .filter(
      (row) =>
        (!statusFilter || row.assessment.status === statusFilter) &&
        (!search ||
          (row.order + " " + row.pet.id + " " + row.pet.name + " " + (row.owner?.name ?? ""))
            .toLowerCase()
            .includes(search.toLowerCase())),
    );

  const columns: Column<(typeof rows)[number]>[] = [
    { key: "order", label: "Order", value: (row) => row.order },
    { key: "petId", label: "Participant ID", value: (row) => row.pet.id },
    { key: "pet", label: "Pet", value: (row) => row.pet.name },
    { key: "owner", label: "Owner", value: (row) => row.owner?.name ?? "-" },
    {
      key: "status",
      label: "Status",
      value: (row) => row.assessment.status,
      render: (row) => (
        <span className={"status-badge status-" + STATUS_TONE[row.assessment.status]}>
          <span className="status-dot" />
          {STATUS_LABEL[row.assessment.status]}
        </span>
      ),
    },
    {
      key: "assessment",
      label: "Assessment",
      value: (row) => totalScore(row.assessment, criteria),
      render: (row) =>
        row.assessment.status === "judging" ? (
          <div className="contest-score-inputs">
            {criteria.map((criterion) => (
              <Field key={criterion.name} label={criterion.name + " /" + criterion.maxPoints}>
                <Input
                  type="number"
                  min={0}
                  max={criterion.maxPoints}
                  value={row.assessment.scores[criterion.name] ?? ""}
                  onChange={(event) =>
                    updateAssessment(row.pet.id, {
                      scores: { ...row.assessment.scores, [criterion.name]: Number(event.target.value) },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        ) : row.assessment.status === "completed" ? (
          <strong>
            {totalScore(row.assessment, criteria)} / {totalMaxScore}
          </strong>
        ) : (
          "-"
        ),
    },
    {
      key: "actions",
      label: "Action",
      value: () => "",
      render: (row) => (
        <div className="row-actions">
          {row.assessment.status === "waiting" && (
            <Button size="sm" onClick={() => setStatus(row.pet.id, "judging")}>
              Start Judging
            </Button>
          )}
          {row.assessment.status === "judging" && (
            <>
              <Button
                size="sm"
                disabled={!isReadyToComplete(row.assessment, criteria)}
                onClick={() => setStatus(row.pet.id, "completed")}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(row.pet.id, "dns")}>
                DNS
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(row.pet.id, "dq")}>
                DQ
              </Button>
            </>
          )}
          {(row.assessment.status === "completed" ||
            row.assessment.status === "dns" ||
            row.assessment.status === "dq") && (
            <Button size="sm" variant="ghost" onClick={() => setStatus(row.pet.id, "waiting")}>
              Reopen
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <CompetitionContext competition={competition} active="contest" />
      <EventPartners eventId={competition.eventId} />
      <PageHeading
        title="Participant Judging"
        description="Judges assess participants in parallel. A participant moves from Waiting to In Judging when assessment begins."
      />
      <div className="stats-grid">
        <div className="stat">
          <span>Animal</span>
          <strong>{competition.animal}</strong>
        </div>
        <div className="stat">
          <span>Total Participants</span>
          <strong>{participants.length}</strong>
        </div>
        <div className="stat">
          <span>Check Items</span>
          <strong>{criteria.length}</strong>
        </div>
        <div className="stat">
          <span>Total Max Score</span>
          <strong>{totalMaxScore}</strong>
        </div>
      </div>
      <div className="section-head">
        <strong>
          {completedCount} / {participants.length} confirmed
        </strong>
        <Button
          variant="secondary"
          disabled={!completedCount}
          onClick={() => setShowLeaderboard((current) => !current)}
        >
          <Trophy size={15} />
          Leaderboard
        </Button>
      </div>
      {showLeaderboard && (
        <section>
          <div className="section-head">
            <h2>Final Standings</h2>
          </div>
          <DataTable
            rows={participants
              .filter((item) => assessmentFor(assessments, item.pet.id).status === "completed")
              .map((item) => ({
                id: item.pet.id,
                name: item.pet.name,
                total: totalScore(assessmentFor(assessments, item.pet.id), criteria),
              }))
              .sort((a, b) => b.total - a.total)}
            columns={[
              { key: "name", label: "Pet", value: (row) => row.name },
              { key: "total", label: "Total Score", value: (row) => row.total },
            ]}
          />
        </section>
      )}
      <section>
        <div className="section-head">
          <h2>Participants</h2>
          <p className="muted">Use Participant ID as the primary identifier.</p>
        </div>
        <div className="toolbar">
          <Field label="Search">
            <Input
              type="search"
              placeholder="Search order, participant ID, pet, or owner"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field label="Status">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <DataTable rows={rows.map((row) => ({ ...row, id: row.pet.id }))} columns={columns} label="Contest participants" />
      </section>
    </div>
  );
}
