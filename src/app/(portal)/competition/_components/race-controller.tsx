"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Flag,
  Play,
  Square,
  RotateCcw,
  Timer,
  Save,
  Trophy,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { PageHeading } from "@/components/common/page-heading";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type Column } from "@/components/common/data-table";
import { usePortalData } from "@/components/providers/portal-data-provider";
import { CompetitionContext } from "./competition-context";
import { EventPartners } from "./event-partners";
import { CheckpointControl } from "./checkpoint-control";
import { SwapParticipantDialog } from "./swap-participant-dialog";
import { useRaceController } from "./use-race-controller";
import { formatRaceTime, validPositions } from "../_lib/race";
import {
  canSwap,
  generateNextRound,
  isRoundComplete,
  parseBracket,
  swapParticipants,
  type RaceMatch,
} from "../_lib/race-bracket";
import { formatDateTime } from "@/lib/format/date";
import type { PortalRecord } from "@/types/portal";

const CURRENT_ACTOR = "Admin Petpet";

export function RaceController({ competition }: { competition: PortalRecord }) {
  const { data, save } = usePortalData();
  const participants = data.registrations
    .filter((row) => row.competitionId === competition.id && row.paymentStatus === "Verified")
    .flatMap((row) => {
      const pet = data.pets.find((item) => item.id === row.petId);
      return pet ? [pet] : [];
    });
  const petById = (id: string) => data.pets.find((item) => item.id === id);
  const lanes = Math.max(1, Number(competition.lanes) || 4);
  const checkpointRace = competition.type === "Checkpoint Race";
  const checkpointCount = Math.max(1, Number(competition.checkpoints) || 3);
  const cutoff = Math.max(1, Number(competition.cutoff) || 60) * 1000;

  const [bracket, setBracket] = useState(() =>
    parseBracket(competition.raceBracket, participants.map((pet) => pet.id), lanes),
  );
  const [roundIndex, setRoundIndex] = useState(bracket.rounds.length - 1);
  const [matchIndex, setMatchIndex] = useState(0);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [checkpoints, setCheckpoints] = useState<Record<string, number[]>>({});
  const [resetOpen, setResetOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const [qualifiersPerMatch, setQualifiersPerMatch] = useState(1);
  const [swapPetId, setSwapPetId] = useState("");

  const round = bracket.rounds[roundIndex] ?? [];
  const match: RaceMatch | undefined = round[matchIndex];
  const racing = (match?.participantIds ?? []).flatMap((id) => {
    const pet = petById(id);
    return pet ? [pet] : [];
  });

  const { state, dispatch, capture } = useRaceController(cutoff, racing.length);
  const active = state.status === "Running" || state.status === "Countdown";
  const canSave =
    state.status === "Stopped" &&
    validPositions(racing.map((pet) => positions[pet.id] ?? ""), state.captures.length) &&
    (!checkpointRace ||
      racing.every(
        (pet) =>
          ["DNS", "DSQ"].includes(positions[pet.id]) ||
          (checkpoints[pet.id]?.length ?? 0) >= checkpointCount,
      ));

  function persist(next: typeof bracket) {
    setBracket(next);
    save("competitions", { ...competition, raceBracket: JSON.stringify(next) });
  }

  function goToMatch(nextRoundIndex: number, nextMatchIndex: number) {
    setRoundIndex(nextRoundIndex);
    setMatchIndex(nextMatchIndex);
    dispatch({ type: "reset" });
    setPositions({});
    setCheckpoints({});
  }

  function confirmMatchResult() {
    if (!match) return;
    const now = new Date().toISOString();
    const results = Object.fromEntries(
      racing.map((pet) => [
        pet.id,
        {
          position: positions[pet.id],
          time: state.captures[Number(positions[pet.id]) - 1] ?? null,
          checkpointTimes: checkpoints[pet.id] ?? [],
        },
      ]),
    );
    const nextRound = round.map((item, index) =>
      index === matchIndex
        ? { ...item, results, confirmed: true, confirmedAt: now, confirmedBy: CURRENT_ACTOR }
        : item,
    );
    persist({ rounds: bracket.rounds.map((r, i) => (i === roundIndex ? nextRound : r)) });
    dispatch({ type: "save" });
    toast.success("Match result saved");
    const nextPending = nextRound.findIndex((item) => !item.confirmed);
    if (nextPending !== -1) goToMatch(roundIndex, nextPending);
  }

  function generateNext() {
    const nextRound = generateNextRound(round, qualifiersPerMatch, lanes);
    const rounds = [...bracket.rounds, nextRound];
    persist({ rounds });
    goToMatch(rounds.length - 1, 0);
    toast.success("Round " + nextRound[0]?.round + " generated");
  }

  const roundComplete = isRoundComplete(round);
  const isFinalRound = match?.type === "Final";
  const swapCandidates = round
    .flatMap((item, mIndex) => (mIndex === matchIndex ? [] : item.participantIds.map((id) => ({ id, item }))))
    .filter(({ id, item }) => canSwap(item, id))
    .flatMap(({ id }) => {
      const pet = petById(id);
      return pet ? [pet] : [];
    });

  const historyRows = bracket.rounds.flatMap((roundMatches) =>
    roundMatches.flatMap((item) =>
      item.participantIds.map((petId, laneIndex) => {
        const pet = petById(petId);
        const owner = data.users.find((user) => user.id === pet?.ownerUserId);
        const result = item.results[petId];
        return {
          id: item.id + "-" + petId,
          ownerName: owner?.name ?? "-",
          petName: pet?.name ?? "-",
          round: item.round,
          match: item.match,
          type: item.type,
          lane: laneIndex + 1,
          distanceToFinish: checkpointRace
            ? (result?.checkpointTimes?.length ?? 0) + "/" + checkpointCount
            : "-",
          completedTime: result?.time != null ? formatRaceTime(result.time) : "-",
          position: result?.position ?? "-",
          createdDate: item.confirmedAt,
          createdBy: item.confirmedBy,
          updatedDate: item.confirmedAt,
          updatedBy: item.confirmedBy,
        };
      }),
    ),
  );
  const [ownerFilter, setOwnerFilter] = useState("");
  const [petFilter, setPetFilter] = useState("");
  const [roundFilter, setRoundFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const filteredHistory = historyRows.filter(
    (row) =>
      row.ownerName.toLowerCase().includes(ownerFilter.toLowerCase()) &&
      row.petName.toLowerCase().includes(petFilter.toLowerCase()) &&
      (!roundFilter || String(row.round) === roundFilter) &&
      (!matchFilter || String(row.match) === matchFilter) &&
      (!typeFilter || row.type === typeFilter) &&
      (!positionFilter || row.position === positionFilter),
  );
  const historyColumns: Column<(typeof historyRows)[number]>[] = [
    { key: "ownerName", label: "Owner Name", value: (row) => row.ownerName },
    { key: "petName", label: "Pet Name", value: (row) => row.petName },
    { key: "round", label: "Round", value: (row) => row.round },
    { key: "match", label: "Match", value: (row) => row.match },
    { key: "lane", label: "Lane", value: (row) => row.lane },
    { key: "distanceToFinish", label: "Distance to Finish", value: (row) => row.distanceToFinish },
    { key: "completedTime", label: "Completed Time", value: (row) => row.completedTime },
    { key: "position", label: "Position", value: (row) => row.position },
    {
      key: "createdDate",
      label: "Created Date",
      value: (row) => row.createdDate ?? "",
      render: (row) => formatDateTime(row.createdDate),
    },
    { key: "createdBy", label: "Created By", value: (row) => row.createdBy || "-" },
    {
      key: "updatedDate",
      label: "Updated Date",
      value: (row) => row.updatedDate ?? "",
      render: (row) => formatDateTime(row.updatedDate),
    },
    { key: "updatedBy", label: "Updated By", value: (row) => row.updatedBy || "-" },
  ];

  return (
    <div className="page-stack">
      <CompetitionContext competition={competition} active="run-match" />
      <PageHeading title="Run Match" actions={<StatusBadge status={state.status} />} />
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
          <Select
            aria-label="Round"
            value={roundIndex}
            disabled={state.status !== "Ready" && state.status !== "Saved"}
            onChange={(event) => goToMatch(Number(event.target.value), 0)}
          >
            {bracket.rounds.map((_, index) => (
              <option key={index} value={index}>
                Round {index + 1}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span>MATCH</span>
          <Select
            aria-label="Match"
            value={matchIndex}
            disabled={state.status !== "Ready" && state.status !== "Saved"}
            onChange={(event) => goToMatch(roundIndex, Number(event.target.value))}
          >
            {round.map((item, index) => (
              <option key={item.id} value={index}>
                Match {item.match} ({item.type})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span>PARTICIPANTS</span>
          <strong>{racing.length.toString().padStart(2, "0")}</strong>
        </div>
        <div>
          <span>CONFIGURED LANES</span>
          <strong>{lanes}</strong>
        </div>
        <div>
          <span>CUT OFF TIME</span>
          <strong>{cutoff / 1000}s</strong>
        </div>
      </div>
      <EventPartners eventId={competition.eventId} />
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
            <span style={{ width: Math.min(100, (state.elapsed / cutoff) * 100) + "%" }} />
          </div>
          <div className="race-progress-labels">
            <span>Start</span>
            <span>{((cutoff - state.elapsed) / 1000).toFixed(3)} sec remaining</span>
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
          <span className="muted">
            Round {roundIndex + 1} / Match {match?.match ?? "-"}
          </span>
          <Button
            disabled={
              !racing.length ||
              !["Ready", "Running"].includes(state.status) ||
              (state.status === "Running" && state.captures.length >= racing.length)
            }
            className="start-race"
            onClick={() => (state.status === "Ready" ? dispatch({ type: "countdown" }) : capture())}
          >
            {state.status === "Running" ? <Flag size={18} /> : <Play size={18} />}{" "}
            {state.status === "Running" ? "Capture Finish" : "Start Match"}
          </Button>
          <Button variant="secondary" disabled={state.status !== "Running"} onClick={() => dispatch({ type: "stop" })}>
            <Square size={15} />
            Stop Match
          </Button>
          <Button variant="secondary" disabled={active || state.status === "Ready"} onClick={() => setResetOpen(true)}>
            <RotateCcw size={15} />
            Rematch
          </Button>
        </aside>
      </section>
      {roundComplete && !isFinalRound && (
        <section className="assignment-note-card">
          <div>
            <div className="eyebrow">ROUND PROGRESSION</div>
            <strong>Round {roundIndex + 1} complete</strong>
            <p className="muted">
              All matches in this round have been confirmed. Choose how many
              qualifiers advance from each match, then generate the next
              round.
            </p>
          </div>
          <div className="assignment-builder">
            <Field label="Qualifiers per match">
              <Select
                value={qualifiersPerMatch}
                onChange={(event) => setQualifiersPerMatch(Number(event.target.value))}
              >
                {Array.from({ length: lanes }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={generateNext}>
              <Repeat size={15} />
              Generate Next Round
            </Button>
          </div>
        </section>
      )}
      <section>
        <div className="section-head">
          <div>
            <h2>
              Current Match <span className="count-label">{racing.length}</span>
            </h2>
            <p>
              {competition.name} / Round {roundIndex + 1} / Match {match?.match ?? "-"}
            </p>
          </div>
          <Button variant="secondary" disabled={!historyRows.some((row) => row.position !== "-")} onClick={() => setLeaderboard((current) => !current)}>
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
                  <Image className="pet-photo" src={row.photo || "/pet-avatar.jpg"} width={40} height={40} alt="" />
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
              value: (row) => data.users.find((user) => user.id === row.ownerUserId)?.name ?? row.ownerName,
            },
            ...(checkpointRace
              ? [
                  {
                    key: "checkpoints",
                    label: "Distance to Finish",
                    render: (row: PortalRecord) => (
                      <CheckpointControl
                        name={row.name}
                        count={checkpoints[row.id]?.length ?? 0}
                        total={checkpointCount}
                        disabled={state.status !== "Running"}
                        onCapture={() =>
                          setCheckpoints((current) => ({
                            ...current,
                            [row.id]: [...(current[row.id] ?? []), state.elapsed],
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
                    ? formatRaceTime(state.captures[Number(positions[row.id]) - 1])
                    : "--:--.---"}
                </span>
              ),
            },
            {
              key: "position",
              label: "Position / Result",
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
                      Object.entries(positions).some(([id, rank]) => id !== row.id && rank === value)
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
              key: "actions",
              label: "Action",
              value: () => "",
              render: (row) =>
                !match?.confirmed && state.status === "Ready" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!swapCandidates.length}
                    onClick={() => setSwapPetId(row.id)}
                  >
                    <Repeat size={14} />
                    Swap
                  </Button>
                ) : null,
            },
          ]}
        />
        <div className="participant-footer">
          <span className="muted">
            {match?.confirmed ? "Match result confirmed." : "Complete the race, then confirm the match result."}
          </span>
          <Button disabled={!canSave} onClick={confirmMatchResult}>
            <Save size={16} />
            Confirm Match Result
          </Button>
        </div>
      </section>
      {leaderboard && (
        <section className="form-section">
          <h2>Leaderboard</h2>
          <DataTable
            rows={historyRows
              .filter((row) => row.position !== "-" && !["DNS", "DSQ"].includes(row.position))
              .sort((a, b) => Number(a.position) - Number(b.position) || a.round - b.round)}
            columns={[
              { key: "position", label: "Position", value: (row) => row.position },
              { key: "petName", label: "Pet", value: (row) => row.petName },
              { key: "round", label: "Round", value: (row) => row.round },
              { key: "completedTime", label: "Finish Time", value: (row) => row.completedTime },
            ]}
          />
        </section>
      )}
      <section className="form-section">
        <div className="section-head">
          <div>
            <h2>Competition Drawing &amp; Results</h2>
            <p className="muted">Review drawing results, confirmed match results, and progression across rounds.</p>
          </div>
          <span className="muted">{filteredHistory.length} records</span>
        </div>
        <div className="toolbar">
          <Field label="Owner name">
            <Input type="search" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} />
          </Field>
          <Field label="Pet name">
            <Input type="search" value={petFilter} onChange={(event) => setPetFilter(event.target.value)} />
          </Field>
          <Field label="Round">
            <Select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)}>
              <option value="">All rounds</option>
              {bracket.rounds.map((_, index) => (
                <option key={index} value={index + 1}>
                  Round {index + 1}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Match">
            <Select value={matchFilter} onChange={(event) => setMatchFilter(event.target.value)}>
              <option value="">All matches</option>
              {Array.from(new Set(historyRows.map((row) => row.match))).map((value) => (
                <option key={value} value={value}>
                  Match {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Match type">
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All match types</option>
              <option value="Qualification">Qualification</option>
              <option value="Final">Final</option>
            </Select>
          </Field>
          <Field label="Position">
            <Select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="">All positions</option>
              {Array.from(new Set(historyRows.map((row) => row.position))).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <div className="toolbar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setOwnerFilter("");
                setPetFilter("");
                setRoundFilter("");
                setMatchFilter("");
                setTypeFilter("");
                setPositionFilter("");
              }}
            >
              <RotateCcw size={14} />
              Clear Filter
            </Button>
          </div>
        </div>
        <DataTable rows={filteredHistory} columns={historyColumns} label="Competition drawing and results" />
      </section>
      <SwapParticipantDialog
        open={!!swapPetId}
        onOpenChange={(open) => !open && setSwapPetId("")}
        currentPet={petById(swapPetId)}
        candidates={swapCandidates}
        onConfirm={(candidateId) => {
          persist(swapParticipants(bracket, roundIndex, swapPetId, candidateId));
          toast.success("Participants swapped");
        }}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this match?"
        description="Captured times and assigned positions will be cleared."
        confirmLabel="Reset Match"
        onConfirm={() => {
          dispatch({ type: "reset" });
          setPositions({});
          setCheckpoints({});
        }}
      />
    </div>
  );
}
