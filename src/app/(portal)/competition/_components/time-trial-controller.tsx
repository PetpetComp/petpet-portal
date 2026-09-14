"use client";
import { useState } from "react";
import { Flag, Play, RotateCcw, SkipForward, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { DataTable, type Column } from "@/components/common/data-table";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { formatDateTime } from "@/lib/format/date";
import { CompetitionContext } from "./competition-context";
import { EventPartners } from "./event-partners";
import { CheckpointControl } from "./checkpoint-control";
import { useRaceController } from "./use-race-controller";
import { formatRaceTime } from "../_lib/race";
import {
  ATTEMPT_STATUS_LABEL,
  ATTEMPT_STATUS_TONE,
  nextUnresolvedIndex,
  parseAttempts,
  type Attempt,
  type AttemptStatus,
} from "../_lib/time-trial";
import type { PortalRecord } from "@/types/portal";

const CURRENT_ACTOR = "Admin Petpet";
const PRESTART_OPTIONS: { value: AttemptStatus; label: string }[] = [
  { value: "dns", label: "Did Not Start" },
  { value: "dsq", label: "Disqualified" },
];
const ATTEMPT_OPTIONS: { value: AttemptStatus; label: string }[] = [
  { value: "finish", label: "Finish" },
  { value: "dnf", label: "Did Not Finish" },
  { value: "dns", label: "Did Not Start" },
  { value: "dsq", label: "Disqualified" },
];

export function TimeTrialController({ competition }: { competition: PortalRecord }) {
  const { data, save } = usePortalData();
  const participants = data.registrations
    .filter((row) => row.competitionId === competition.id && row.paymentStatus === "Verified")
    .flatMap((row) => {
      const pet = data.pets.find((item) => item.id === row.petId);
      return pet ? [pet] : [];
    });
  const order = participants.map((pet) => pet.id);
  const checkpointVariant = competition.type === "Checkpoint Time Trial";
  const checkpointCount = Math.max(1, Number(competition.checkpoints) || 3);
  const cutoff = Math.max(1, Number(competition.cutoff) || 60) * 1000;

  const [attempts, setAttempts] = useState<Record<string, Attempt>>(() =>
    parseAttempts(competition.timeTrialAttempts),
  );
  const [pointer, setPointer] = useState(() => nextUnresolvedIndex(order, attempts, 0));
  const [checkpointHits, setCheckpointHits] = useState<number[]>([]);
  const [prestartStatus, setPrestartStatus] = useState("");
  const [attemptStatus, setAttemptStatus] = useState("");
  const [leaderboard, setLeaderboard] = useState(false);

  const currentPet = pointer === -1 ? undefined : participants[pointer];
  const { state, dispatch, capture } = useRaceController(cutoff, 1);
  const resolvedCount = Object.keys(attempts).length;

  function persist(next: Record<string, Attempt>) {
    setAttempts(next);
    save("competitions", { ...competition, timeTrialAttempts: JSON.stringify(next) });
    return next;
  }

  function advanceFrom(next: Record<string, Attempt>) {
    setPointer(nextUnresolvedIndex(order, next, pointer + 1));
    dispatch({ type: "reset" });
    setCheckpointHits([]);
    setPrestartStatus("");
    setAttemptStatus("");
  }

  function confirmPrestart() {
    if (!currentPet || !prestartStatus) return;
    const next = persist({
      ...attempts,
      [currentPet.id]: {
        status: prestartStatus as AttemptStatus,
        time: null,
        updatedAt: new Date().toISOString(),
        updatedBy: CURRENT_ACTOR,
      },
    });
    advanceFrom(next);
  }

  function captureCheckpoint() {
    const hits = [...checkpointHits, state.elapsed];
    setCheckpointHits(hits);
    if (checkpointVariant && hits.length >= checkpointCount) {
      capture();
      dispatch({ type: "stop" });
    }
  }

  function captureFinish() {
    capture();
    dispatch({ type: "stop" });
  }

  function confirmAttempt() {
    if (!currentPet || !attemptStatus) return;
    const status = attemptStatus as AttemptStatus;
    const next = persist({
      ...attempts,
      [currentPet.id]: {
        status,
        time: status === "finish" ? (state.captures[0] ?? null) : null,
        distance: checkpointVariant ? checkpointHits.length : undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: CURRENT_ACTOR,
      },
    });
    dispatch({ type: "save" });
    toast.success("Attempt result saved");
    advanceFrom(next);
  }

  function skip() {
    const next = nextUnresolvedIndex(order, attempts, pointer + 1);
    if (next === -1) return;
    setPointer(next);
    dispatch({ type: "reset" });
    setCheckpointHits([]);
  }

  const historyColumns: Column<{
    id: string;
    order: number;
    ownerName: string;
    petName: string;
    status?: AttemptStatus;
    time: string;
    distance: string;
    updatedAt?: string;
    updatedBy?: string;
  }>[] = [
    { key: "order", label: "Order", value: (row) => row.order },
    { key: "ownerName", label: "Owner Name", value: (row) => row.ownerName },
    { key: "petName", label: "Pet Name", value: (row) => row.petName },
    { key: "attempt", label: "Attempt", value: () => 1 },
    {
      key: "status",
      label: "Attempt Status",
      value: (row) => (row.status ? ATTEMPT_STATUS_LABEL[row.status] : "Not Started"),
      render: (row) =>
        row.status ? (
          <span className={"status-badge status-" + ATTEMPT_STATUS_TONE[row.status]}>
            <span className="status-dot" />
            {ATTEMPT_STATUS_LABEL[row.status]}
          </span>
        ) : (
          <span className="status-badge status-neutral">
            <span className="status-dot" />
            Not Started
          </span>
        ),
    },
    { key: "time", label: "Completed Time", value: (row) => row.time },
    ...(checkpointVariant
      ? [{ key: "distance", label: "Distance to Finish", value: (row: { distance: string }) => row.distance }]
      : []),
    {
      key: "createdDate",
      label: "Created Date",
      value: (row) => row.updatedAt ?? "",
      render: (row) => formatDateTime(row.updatedAt),
    },
    { key: "createdBy", label: "Created By", value: (row) => row.updatedBy || "-" },
    {
      key: "updatedDate",
      label: "Updated Date",
      value: (row) => row.updatedAt ?? "",
      render: (row) => formatDateTime(row.updatedAt),
    },
    { key: "updatedBy", label: "Updated By", value: (row) => row.updatedBy || "-" },
  ];

  const historyRows = participants.map((pet, index) => {
    const attempt = attempts[pet.id];
    const owner = data.users.find((user) => user.id === pet.ownerUserId);
    return {
      id: pet.id,
      order: index + 1,
      ownerName: owner?.name ?? "-",
      petName: pet.name,
      status: attempt?.status,
      time: attempt?.time != null ? formatRaceTime(attempt.time) : "-",
      distance: attempt ? (attempt.distance ?? 0) + "/" + checkpointCount : "-",
      updatedAt: attempt?.updatedAt,
      updatedBy: attempt?.updatedBy,
    };
  });

  return (
    <div className="page-stack">
      <CompetitionContext competition={competition} active="time-trial" />
      <PageHeading
        title="Run Competition"
        description="Prepare the participant and attempt before starting the time trial."
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
          <span>TOTAL PARTICIPANTS</span>
          <strong>{participants.length}</strong>
        </div>
        <div>
          <span>CUT OFF TIME</span>
          <strong>{cutoff / 1000}s</strong>
        </div>
        <div>
          <span>TIME TYPE</span>
          <strong>Cutoff</strong>
        </div>
      </div>
      <EventPartners eventId={competition.eventId} />
      <section className="run-match-master-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">TIME TRIAL CONTROL</div>
            <h2>{currentPet ? currentPet.name : "All participants resolved"}</h2>
            <p className="muted">
              {currentPet
                ? "Run Competition will prepare the starting order automatically."
                : "Every participant has an attempt result recorded."}
            </p>
          </div>
          <div className="row-actions">
            <span className="muted">
              {resolvedCount} / {participants.length} attempts resolved
            </span>
            <Button
              variant="secondary"
              disabled={!resolvedCount}
              onClick={() => setLeaderboard((current) => !current)}
            >
              <Trophy size={15} />
              {leaderboard ? "Hide" : "View"} Leaderboard
            </Button>
          </div>
        </div>
        {currentPet && (
          <div className="race-control">
            <div className="race-timer-area">
              <div className="section-head">
                <h2>
                  <Timer size={18} />
                  Time Trial Timer
                </h2>
                <span className="timer-tag">Cutoff {cutoff / 1000}s</span>
              </div>
              <div
                className={"official-timer " + (state.status === "Running" ? "is-running" : "")}
                aria-label="Official race time"
              >
                {state.status === "Countdown" ? String(state.countdown) : formatRaceTime(state.elapsed)}
              </div>
              <div className="timer-caption">
                {state.status === "Countdown"
                  ? "GET READY"
                  : state.status === "Ready"
                    ? "READY TO START"
                    : state.status === "Running"
                      ? "ATTEMPT IN PROGRESS"
                      : "ATTEMPT FINISHED"}
              </div>
              {checkpointVariant && state.status === "Running" && (
                <CheckpointControl
                  name={currentPet.name}
                  count={checkpointHits.length}
                  total={checkpointCount}
                  disabled={false}
                  onCapture={captureCheckpoint}
                />
              )}
            </div>
            <aside className="race-actions">
              <h3>Attempt Actions</h3>
              {state.status === "Ready" && (
                <>
                  <Button className="start-race" onClick={() => dispatch({ type: "countdown" })}>
                    <Play size={18} />
                    Start Attempt
                  </Button>
                  <Button variant="secondary" disabled={resolvedCount >= participants.length - 1} onClick={skip}>
                    <SkipForward size={15} />
                    Skip to Next Participant
                  </Button>
                  <div className="assignment-note-card">
                    <div>
                      <strong>Cannot start?</strong>
                      <p className="muted">Record DNS or Disqualified.</p>
                    </div>
                    <div className="assignment-builder">
                      <Field label="Result">
                        <Select value={prestartStatus} onChange={(event) => setPrestartStatus(event.target.value)}>
                          <option value="">Select result</option>
                          {PRESTART_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button variant="secondary" disabled={!prestartStatus} onClick={confirmPrestart}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                </>
              )}
              {state.status === "Running" && !checkpointVariant && (
                <Button className="start-race" onClick={captureFinish}>
                  <Flag size={18} />
                  Capture Finish
                </Button>
              )}
              {(state.status === "Stopped" || state.status === "Saved") && (
                <div className="assignment-note-card">
                  <div>
                    <div className="eyebrow">ATTEMPT RESULT</div>
                    <strong>
                      Provisional Time: {state.captures[0] != null ? formatRaceTime(state.captures[0]) : "-"}
                    </strong>
                    <p className="muted">Review the provisional result before confirming.</p>
                  </div>
                  <div className="assignment-builder">
                    <Field label="Attempt Status">
                      <Select value={attemptStatus} onChange={(event) => setAttemptStatus(event.target.value)}>
                        <option value="">Select attempt status</option>
                        {ATTEMPT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button disabled={!attemptStatus || state.status === "Saved"} onClick={confirmAttempt}>
                      Confirm Attempt Result
                    </Button>
                    <Button variant="destructive" onClick={() => dispatch({ type: "reset" })}>
                      <RotateCcw size={15} />
                      Rematch Attempt
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>
      {leaderboard && (
        <section className="form-section">
          <h2>Leaderboard</h2>
          <DataTable
            rows={historyRows.filter((row) => row.status === "finish").sort((a, b) => a.time.localeCompare(b.time))}
            columns={[
              { key: "petName", label: "Pet", value: (row) => row.petName },
              { key: "time", label: "Finish Time", value: (row) => row.time },
            ]}
          />
        </section>
      )}
      <section className="form-section">
        <div className="eyebrow">PROGRESSION</div>
        <h2>Participant Attempts</h2>
        <p className="muted">
          Participants stay grouped. Completed participants move below the
          active queue.
        </p>
        <DataTable rows={historyRows} columns={historyColumns} label="Participant attempts" />
      </section>
    </div>
  );
}
