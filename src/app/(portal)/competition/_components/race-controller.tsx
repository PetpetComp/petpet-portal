"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Flag,
  Play,
  Square,
  RotateCcw,
  Timer,
  Save,
  Trophy,
  Check,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable } from "@/components/common/data-table";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { CompetitionContext } from "./competition-context";
import { EventPartners } from "./event-partners";
import { CheckpointControl } from "./checkpoint-control";
import { useRaceController } from "./use-race-controller";
import { formatRaceTime, validPositions } from "../_lib/race";
import type { PortalRecord } from "@/types/portal";

export function RaceController({
  competition,
  timeTrial = false,
}: {
  competition: PortalRecord;
  timeTrial?: boolean;
}) {
  const { data, save } = usePortalData();
  const participants = data.registrations
    .filter(
      (row) =>
        row.competitionId === competition.id &&
        row.paymentStatus === "Verified",
    )
    .flatMap((row) => {
      const pet = data.pets.find((pet) => pet.id === row.petId);
      return pet ? [pet] : [];
    });
  const [trialId, setTrialId] = useState(participants[0]?.id ?? "");
  const [match, setMatch] = useState("1");
  const lanes = Math.max(1, Number(competition.lanes) || 4);
  const drawing: string[] = competition.drawing
    ? JSON.parse(competition.drawing)
    : participants.map((pet) => pet.id);
  const ordered = [
    ...drawing.filter((id) => participants.some((pet) => pet.id === id)),
    ...participants.map((pet) => pet.id).filter((id) => !drawing.includes(id)),
  ];
  const matchIds = ordered.slice(
    (Number(match) - 1) * lanes,
    Number(match) * lanes,
  );
  const racing = timeTrial
    ? participants.filter((pet) => pet.id === trialId)
    : matchIds.flatMap((id) => {
        const pet = participants.find((pet) => pet.id === id);
        return pet ? [pet] : [];
      });
  const cutoff = Math.max(1, Number(competition.cutoff) || 60) * 1000;
  const { state, dispatch, capture } = useRaceController(cutoff, racing.length);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [checkpoints, setCheckpoints] = useState<Record<string, number[]>>({});
  const checkpointRace = competition.type === "Checkpoint Race";
  const checkpointCount = Math.max(1, Number(competition.checkpoints) || 3);
  const [resetOpen, setResetOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const active = state.status === "Running" || state.status === "Countdown";
  const canSave =
    state.status === "Stopped" &&
    validPositions(
      racing.map((pet) => positions[pet.id] ?? ""),
      state.captures.length,
    ) &&
    (!checkpointRace ||
      racing.every(
        (pet) =>
          ["DNS", "DSQ"].includes(positions[pet.id]) ||
          (checkpoints[pet.id]?.length ?? 0) >= checkpointCount,
      ));
  function saveResults() {
    const previous: {
      petId: string;
      name: string;
      position: string;
      time: number | null;
      match?: string;
    }[] = competition.results ? JSON.parse(competition.results) : [];
    const result = [
      ...previous.filter((row) => !racing.some((pet) => pet.id === row.petId)),
      ...racing.map((pet) => ({
        petId: pet.id,
        name: pet.name,
        position: positions[pet.id],
        time: state.captures[Number(positions[pet.id]) - 1] ?? null,
        match: timeTrial ? trialId : match,
        checkpointTimes: checkpoints[pet.id] ?? [],
      })),
    ];
    save("competitions", {
      ...competition,
      results: JSON.stringify(result),
      resultStatus: "Saved",
    });
    dispatch({ type: "save" });
    toast.success("Race results saved");
  }
  return (
    <div className="page-stack">
      <CompetitionContext
        competition={competition}
        active={timeTrial ? "time-trial" : "run-match"}
      />
      <PageHeading
        title={timeTrial ? "Time Trial" : "Run Match"}
        actions={<StatusBadge status={state.status} />}
      />
      <div className="race-summary">
        <div>
          <span>COMPETITION</span>
          <strong>{competition.name}</strong>
          <small>
            {competition.type} / {competition.animal}
          </small>
        </div>
        <div>
          <span>ROUND</span>
          <strong>Round 1</strong>
        </div>
        <div>
          <span>MATCH</span>
          <Select
            aria-label="Match"
            value={match}
            disabled={state.status !== "Ready" && state.status !== "Saved"}
            onChange={(event) => {
              setMatch(event.target.value);
              dispatch({ type: "reset" });
              setPositions({});
              setCheckpoints({});
            }}
          >
            {Array.from(
              { length: Math.max(1, Math.ceil(participants.length / lanes)) },
              (_, index) => (
                <option key={index} value={index + 1}>
                  Heat {index + 1}
                </option>
              ),
            )}
          </Select>
        </div>
        <div>
          <span>PARTICIPANTS</span>
          <strong>{racing.length.toString().padStart(2, "0")}</strong>
        </div>
        <div>
          <span>LANES</span>
          <strong>{lanes}</strong>
        </div>
      </div>
      <EventPartners eventId={competition.eventId} />
      {timeTrial && (
        <label className="form-field">
          Participant
          <Select
            value={trialId}
            aria-label="Time trial participant"
            disabled={state.status !== "Ready" && state.status !== "Saved"}
            onChange={(event) => {
              setTrialId(event.target.value);
              dispatch({ type: "reset" });
              setPositions({});
            }}
          >
            {participants.map((pet) => (
              <option value={pet.id} key={pet.id}>
                {pet.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <section className="race-control">
        <div className="race-timer-area">
          <div className="section-head">
            <h2>
              <Timer size={18} />
              Official Race Timer
            </h2>
            <span className="timer-tag">Cutoff {cutoff / 1000}s</span>
          </div>
          <div
            className={
              "official-timer " +
              (state.status === "Running" ? "is-running" : "")
            }
            aria-label="Official race time"
          >
            {state.status === "Countdown"
              ? String(state.countdown)
              : formatRaceTime(state.elapsed)}
          </div>
          <div className="timer-caption">
            {state.status === "Countdown"
              ? "GET READY"
              : state.status === "Ready"
                ? "READY TO START"
                : state.status === "Saved"
                  ? "RESULTS SAVED"
                  : state.status === "Running"
                    ? "RACE IN PROGRESS"
                    : "RACE FINISHED"}
          </div>
          <div
            className="race-progress"
            role="progressbar"
            aria-label="Race progress"
            aria-valuemin={0}
            aria-valuemax={cutoff / 1000}
            aria-valuenow={Math.round(state.elapsed / 1000)}
          >
            <span
              style={{
                width: Math.min(100, (state.elapsed / cutoff) * 100) + "%",
              }}
            />
          </div>
          <div className="race-progress-labels">
            <span>Start</span>
            <span>
              {((cutoff - state.elapsed) / 1000).toFixed(3)} sec remaining
            </span>
          </div>
          <div className="capture-heading">
            <span>CAPTURED FINISH TIMES</span>
            <span>
              {state.captures.length} / {racing.length}
            </span>
          </div>
          <div className="capture-list">
            {state.captures.length ? (
              state.captures.map((time, index) => (
                <span key={index}>
                  <b>{index + 1}</b>
                  {formatRaceTime(time)}
                </span>
              ))
            ) : (
              <span className="no-captures">No finish times captured</span>
            )}
          </div>
        </div>
        <aside className="race-actions">
          <h3>Race Actions</h3>
          <span className="muted">Heat {match} / Round 1</span>
          <Button
            disabled={
              !racing.length ||
              !["Ready", "Running"].includes(state.status) ||
              (state.status === "Running" &&
                state.captures.length >= racing.length)
            }
            className="start-race"
            onClick={() =>
              state.status === "Ready"
                ? dispatch({ type: "countdown" })
                : capture()
            }
          >
            {state.status === "Running" ? (
              <Flag size={18} />
            ) : (
              <Play size={18} />
            )}{" "}
            {state.status === "Running" ? "Capture Finish" : "Start Race"}
          </Button>
          <Button
            variant="secondary"
            disabled={state.status !== "Running"}
            onClick={() => dispatch({ type: "stop" })}
          >
            <Square size={15} />
            Stop Race
          </Button>
          <Button
            variant="secondary"
            disabled={active || state.status === "Ready"}
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw size={15} />
            Rematch
          </Button>
          <div className="race-action-divider" />
          <Button
            variant="ghost"
            disabled={active || state.status === "Ready"}
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw size={14} />
            Reset Results
          </Button>
          <span className="race-ready">
            <span className="status-dot" />
            {racing.length
              ? racing.length + " participants ready"
              : "No verified participants"}
          </span>
        </aside>
      </section>
      <section>
        <div className="section-head">
          <div>
            <h2>
              Race Participants{" "}
              <span className="count-label">{racing.length}</span>
            </h2>
            <p>
              {competition.name} / Heat {match}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!competition.results}
            onClick={() => setLeaderboard(!leaderboard)}
          >
            <Trophy size={15} />
            {leaderboard ? "Hide" : "View"} Leaderboard
          </Button>
        </div>
        <DataTable
          label="Race participants"
          rows={racing}
          columns={[
            {
              key: "name",
              label: "Pet",
              value: (row) => row.name,
              render: (row) => (
                <div className="record-name">
                  <Image
                    className="pet-photo"
                    src={row.photo || "/pet-avatar.jpg"}
                    width={40}
                    height={40}
                    alt=""
                  />
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.variant}</small>
                  </div>
                </div>
              ),
            },
            {
              key: "owner",
              label: "Owner",
              value: (row) =>
                data.users.find((user) => user.id === row.ownerUserId)?.name ??
                row.ownerName,
            },
            ...(checkpointRace
              ? [
                  {
                    key: "checkpoints",
                    label: "Checkpoints",
                    render: (row: PortalRecord) => (
                      <CheckpointControl
                        name={row.name}
                        count={checkpoints[row.id]?.length ?? 0}
                        total={checkpointCount}
                        disabled={state.status !== "Running"}
                        onCapture={() =>
                          setCheckpoints((current) => ({
                            ...current,
                            [row.id]: [
                              ...(current[row.id] ?? []),
                              state.elapsed,
                            ],
                          }))
                        }
                      />
                    ),
                  },
                ]
              : []),
            {
              key: "time",
              label: "Finish Time",
              render: (row) => (
                <span className="finish-time">
                  {state.captures[Number(positions[row.id]) - 1] !== undefined
                    ? formatRaceTime(
                        state.captures[Number(positions[row.id]) - 1],
                      )
                    : "--:--.---"}
                </span>
              ),
            },
            {
              key: "position",
              label: "Position",
              render: (row) => (
                <Select
                  aria-label={"Position for " + row.name}
                  disabled={state.status === "Saved" || active}
                  value={positions[row.id] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value &&
                      !["DNS", "DSQ"].includes(value) &&
                      Object.entries(positions).some(
                        ([id, rank]) => id !== row.id && rank === value,
                      )
                    ) {
                      toast.error("This position is already assigned");
                      return;
                    }
                    setPositions({ ...positions, [row.id]: value });
                  }}
                >
                  <option value="">Unassigned</option>
                  {racing.map((_, index) => (
                    <option key={index} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                  <option>DNS</option>
                  <option>DSQ</option>
                </Select>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <StatusBadge
                  status={
                    positions[row.id]
                      ? state.status === "Saved"
                        ? "Saved"
                        : "Assigned"
                      : "Pending"
                  }
                />
              ),
            },
          ]}
        />
        <div className="participant-footer">
          <Link
            className="link-button secondary"
            href="/event-management/event-registration/create"
          >
            <Plus size={15} />
            Register Participant
          </Link>
          <Button disabled={!canSave} onClick={saveResults}>
            {state.status === "Saved" ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            Save Race Result
          </Button>
        </div>
      </section>
      {leaderboard && competition.results && (
        <section className="form-section">
          <h2>Saved Leaderboard</h2>
          <DataTable
            rows={(
              JSON.parse(competition.results) as {
                petId: string;
                name: string;
                position: string;
                time: number | null;
              }[]
            )
              .map((row) => ({ ...row, id: row.petId }))
              .sort(
                (a, b) =>
                  (Number(a.position) || 999) - (Number(b.position) || 999),
              )}
            columns={[
              {
                key: "position",
                label: "Position",
                value: (row) => row.position,
              },
              { key: "name", label: "Pet", value: (row) => row.name },
              {
                key: "time",
                label: "Finish Time",
                render: (row) =>
                  row.time === null ? "-" : formatRaceTime(row.time),
              },
            ]}
          />
        </section>
      )}
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this heat?"
        description="Captured times and assigned positions will be cleared."
        confirmLabel="Reset Heat"
        onConfirm={() => {
          dispatch({ type: "reset" });
          setPositions({});
          setCheckpoints({});
        }}
      />
    </div>
  );
}
