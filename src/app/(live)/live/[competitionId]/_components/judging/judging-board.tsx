"use client";
import { useRef, useState } from "react";
import { CircleCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LockError } from "@/domains/judging/api";
import {
  JUDGING_API_IS_MOCK,
  JUDGING_MOCK_BANNER,
  TOTAL_SCORE_MAX,
} from "@/domains/judging/constants";
import { nextUnscored, queueProgress } from "@/domains/judging/queue";
import { useRetryLock, useSubmitAndLock } from "@/domains/judging/queries";
import { validateScorecard, weightedTotal } from "@/domains/judging/scoring";
import type { Judging, JudgingParticipant } from "@/domains/judging/types";
import { RunDialog } from "../run/run-dialogs";
import { mergeScores } from "./autosave";
import {
  CriterionCard,
  formatScore,
  noteDomId,
  sliderDomId,
} from "./criterion-card";
import { JudgingQueue } from "./judging-queue";
import { SaveIndicator } from "./save-indicator";
import { useJudgingAutosave } from "./use-judging-autosave";

/** Banner kuning selama API judging masih mock; dimatikan lewat satu konstanta di domain judging. */
function MockBanner() {
  if (!JUDGING_API_IS_MOCK) return null;
  return (
    <p
      role="note"
      className="bg-warning-soft text-event-day-ink rounded-xl px-4 py-3 text-sm font-semibold"
    >
      {JUDGING_MOCK_BANNER}
    </p>
  );
}

/** Scroll halus kecuali pengguna memilih prefers-reduced-motion. Dipanggil saat fokus ke error. */
function scrollBehavior(): ScrollBehavior {
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "auto" : "smooth";
}

/** Pesan dari error apa pun untuk toast. */
function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Papan Judging: antrean di kiri (tablet ke atas) atau di bawah (HP), form penilaian satu peserta
 * di kanan. Dipanggil dari LiveJudging setelah data `Judging` dimuat.
 *
 * Alur: juri memilih peserta -> menggeser slider (autosave DRAFT, lihat `useJudgingAutosave`) ->
 * "Submit & lock score" -> validasi lokal (`validateScorecard`) -> dialog konfirmasi -> flush
 * simpanan -> `useSubmitAndLock` -> toast, lalu otomatis pindah ke peserta berikutnya yang belum
 * dinilai. Total selalu dihitung ulang di layar dengan `weightedTotal` (bukan angka dari API).
 */
export function JudgingBoard({
  competitionId,
  judging,
}: {
  competitionId: string;
  judging: Judging;
}) {
  const autosave = useJudgingAutosave(competitionId, judging);
  const submit = useSubmitAndLock(competitionId);
  const retryLock = useRetryLock(competitionId);
  const mainRef = useRef<HTMLElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      nextUnscored(judging.participants, null) ??
      judging.participants[0]?.entryId ??
      null,
  );
  const [showErrors, setShowErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const progress = queueProgress(judging.participants);
  const participant: JudgingParticipant | undefined = judging.participants.find(
    (p) => p.entryId === selectedId,
  );

  if (judging.criteria.length === 0 || !participant) {
    return (
      <div className="grid gap-4 p-4 md:p-7">
        <MockBanner />
        <p className="border-border bg-card text-muted-foreground rounded-2xl border p-8 text-center">
          {judging.criteria.length === 0
            ? "No scoring criteria are set for this competition yet."
            : "No participants have checked in yet."}
        </p>
      </div>
    );
  }

  const entryId = participant.entryId;
  const dirtyEntry = autosave.dirty[entryId];
  const scores = mergeScores(participant.scores, dirtyEntry);
  const judgeNote = dirtyEntry?.judgeNote ?? participant.judgeNote;
  const total = weightedTotal(judging.criteria, scores);
  const anyScore = judging.criteria.some(
    (c) => scores[c.id]?.score !== null && scores[c.id]?.score !== undefined,
  );
  const locked = participant.status === "LOCKED";
  const awaitingLock = participant.status === "SUBMITTED";
  const editable =
    judging.canScore &&
    participant.actions.score &&
    (participant.status === "NOT_SCORED" || participant.status === "DRAFT");
  const validation = validateScorecard(judging.criteria, scores);
  const errors = showErrors ? validation.errors : {};
  const allScored = progress.total > 0 && progress.scored === progress.total;

  /** Memilih peserta lain: simpan dulu yang sedang dibuka, lalu ganti. Dari antrean. */
  function selectParticipant(id: string) {
    if (id === selectedId) return;
    if (selectedId) void autosave.flushEntry(selectedId);
    setSelectedId(id);
    setShowErrors(false);
    mainRef.current?.scrollIntoView?.({
      behavior: scrollBehavior(),
      block: "start",
    });
  }

  /** Setelah satu peserta ter-lock: buka peserta berikutnya yang belum dinilai (kalau ada). */
  function goToNextUnscored(doneId: string) {
    const queue = judging.participants.map((p) =>
      p.entryId === doneId ? { ...p, status: "LOCKED" as const } : p,
    );
    const next = nextUnscored(queue, doneId);
    setShowErrors(false);
    if (next) setSelectedId(next);
  }

  /** Klik "Submit & lock score": validasi dulu; bila ada yang salah, fokus ke yang pertama. */
  function handleSubmitClick() {
    if (!validation.valid) {
      setShowErrors(true);
      const id = validation.firstInvalidId;
      if (!id) return;
      const isNote = validation.errors[id].startsWith("A note");
      const target = document.getElementById(
        isNote ? noteDomId(id) : sliderDomId(id),
      );
      target?.scrollIntoView?.({
        behavior: scrollBehavior(),
        block: "center",
      });
      target?.focus();
      return;
    }
    setConfirmOpen(true);
  }

  /** Konfirmasi di dialog: flush simpanan, lalu submit + lock. */
  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      const clean = await autosave.flushEntry(entryId);
      const scorecardId =
        autosave.scorecardIdOf(entryId) ?? participant?.scorecardId;
      if (!clean || !scorecardId) {
        toast.error(
          "Your latest changes are not saved yet. Check the connection and try again.",
        );
        return;
      }
      await submit.mutateAsync({ scorecardId, judgeNote });
      toast.success("Score locked");
      goToNextUnscored(entryId);
    } catch (cause) {
      if (cause instanceof LockError)
        toast.error("Score submitted but not locked yet. Use Retry lock.");
      else toast.error(messageOf(cause, "Unable to submit this score."));
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  /** "Retry lock" untuk scorecard yang sudah SUBMITTED tetapi belum ter-lock. */
  async function handleRetryLock() {
    const scorecardId = participant?.scorecardId;
    if (!scorecardId) return;
    try {
      await retryLock.mutateAsync(scorecardId);
      toast.success("Score locked");
      goToNextUnscored(entryId);
    } catch (cause) {
      toast.error(messageOf(cause, "Unable to lock this score."));
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5 p-4 pb-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-7 md:p-7">
      <div className="min-w-0 md:col-span-2">
        <MockBanner />
      </div>

      <section
        ref={mainRef}
        aria-label="Scorecard"
        className="grid min-w-0 content-start gap-4 md:col-start-2 md:row-start-2"
        onBlur={() => void autosave.flushEntry(entryId)}
      >
        {allScored && (
          <p
            role="status"
            className="bg-success-soft text-done flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
          >
            <CircleCheck size={18} aria-hidden />
            All participants scored
          </p>
        )}
        {!judging.canScore && (
          <p
            role="note"
            className="bg-primary-soft text-primary-dark rounded-xl px-4 py-3 text-sm font-semibold"
          >
            {judging.judge
              ? "Scoring is closed for this competition. You can read the scorecards here."
              : "Only assigned judges can score. You can follow the queue and read scorecards here."}
          </p>
        )}

        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="grid min-w-0">
            <h2 className="font-display flex flex-wrap items-baseline gap-x-3 text-3xl leading-tight font-bold">
              <span className="wrap-break-word">{participant.petName}</span>
              <span className="text-muted-foreground font-mono text-lg">
                {participant.bibNumber}
              </span>
            </h2>
            <p className="text-muted-foreground">
              {participant.ownerName}
              {participant.petMorphName ? ` - ${participant.petMorphName}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {locked && (
              <span className="bg-muted text-primary-dark flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Lock size={13} aria-hidden />
                Locked
              </span>
            )}
            {editable && (
              <SaveIndicator
                status={autosave.status}
                onRetry={autosave.flushAll}
              />
            )}
          </div>
        </div>

        {judging.criteria.map((criterion) => (
          <CriterionCard
            key={`${entryId}:${criterion.id}`}
            criterion={criterion}
            entry={scores[criterion.id] ?? { score: null, note: "" }}
            readOnly={!editable}
            error={errors[criterion.id]}
            onScore={(score) => autosave.setScore(entryId, criterion.id, score)}
            onNote={(note) =>
              autosave.setCriterionNote(entryId, criterion.id, note)
            }
          />
        ))}

        {(editable || judgeNote !== "") && (
          <div className="bg-card grid gap-1 rounded-2xl p-4">
            <label htmlFor="judge-note" className="font-bold">
              Overall note{" "}
              <span className="text-muted-foreground text-sm font-normal">
                (optional)
              </span>
            </label>
            {editable ? (
              <textarea
                id="judge-note"
                rows={2}
                value={judgeNote}
                onChange={(e) =>
                  autosave.setJudgeNote(entryId, e.currentTarget.value)
                }
                className="border-input bg-card min-h-20 w-full resize-y rounded-xl border p-3 text-sm"
              />
            ) : (
              <p className="text-sm">{judgeNote}</p>
            )}
          </div>
        )}

        <div className="border-border bg-card sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-md md:static md:shadow-none">
          <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">Total</span>
            <b
              data-testid="total"
              className="font-mono text-[26px] leading-none"
            >
              {anyScore ? formatScore(total) : "--"}
            </b>
            <span className="text-muted-foreground font-mono text-sm">
              /{TOTAL_SCORE_MAX}
            </span>
          </span>
          {editable && (
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={busy}
              className="bg-judging-accent min-h-14 flex-1 rounded-[14px] px-5 text-[17px] font-extrabold text-[#2a0530] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8c75bb] disabled:opacity-60 sm:max-w-80 sm:flex-none"
            >
              Submit &amp; lock score
            </button>
          )}
          {awaitingLock && judging.canScore && (
            <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
              <span className="text-event-day-ink text-sm font-semibold">
                Submitted, not locked yet
              </span>
              <Button
                className="min-h-12 px-5"
                disabled={retryLock.isPending}
                onClick={() => void handleRetryLock()}
              >
                Retry lock
              </Button>
            </div>
          )}
        </div>
      </section>

      <aside className="min-w-0 md:col-start-1 md:row-start-2 md:self-start">
        <JudgingQueue
          participants={judging.participants}
          selectedId={selectedId}
          onSelect={selectParticipant}
        />
      </aside>

      <RunDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busy) setConfirmOpen(open);
        }}
        title="Lock this score?"
        description={`Total ${formatScore(total)} /${TOTAL_SCORE_MAX} for ${participant.petName}. You cannot change this score after locking.`}
      >
        <div className="mt-6 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Button
            variant="secondary"
            className="min-h-12"
            disabled={busy}
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConfirm()}
            className="bg-judging-accent min-h-12 rounded-lg px-4 font-extrabold text-[#2a0530] hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "Locking..." : "Lock score"}
          </button>
        </div>
      </RunDialog>
    </div>
  );
}
