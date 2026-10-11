"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, Shuffle, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCutoff,
  formatTimer,
  performanceClock,
  type Clock,
} from "@/domains/matches/time";
import { newClientRequestId } from "@/domains/timetrial/api";
import {
  attemptFacts,
  latestCountedAttempt,
  nextAttemptNumber,
} from "@/domains/timetrial/attempts";
import {
  TIMETRIAL_API_IS_MOCK,
  TIMETRIAL_MOCK_BANNER,
  UP_NEXT_SIZE,
} from "@/domains/timetrial/constants";
import {
  pendingResultAttempt,
  phaseOf,
  primaryActionOf,
  startAttemptLabel,
} from "@/domains/timetrial/phase";
import { participantProgress, upNext } from "@/domains/timetrial/rank";
import {
  useCompleteParticipant,
  useCreateAttempt,
  useDisqualify,
  useMarkDns,
  useQueue,
  useRecordResult,
  useReopenParticipant,
  useRetryAttempt,
  useRevokePenalty,
  useSkipParticipant,
  useStartAttempt,
  useStopAttempt,
  useTimeoutAttempt,
  useUndoAttempt,
} from "@/domains/timetrial/queries";
import type { Queue, QueueParticipant } from "@/domains/timetrial/types";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "../live-connection";
import { ConfirmActionDialog, DisqualifyDialog } from "../run/run-dialogs";
import { isoSpanMs } from "../run/race-timer";
import { RaceTimerDisplay } from "../run/race-timer-display";
import { useRaceTimer } from "../run/use-race-timer";
import { useWakeLock } from "../run/use-wake-lock";
import { ParticipantCard } from "./participant-card";
import {
  attemptResultText,
  lastCountedAttempt,
  rankNote,
  statusText,
} from "./run-helpers";
import { waitingResultCount, type PendingResult } from "./result-queue";
import { BestTimesPanel, UpNextPanel } from "./run-side-panel";
import { useResultQueue } from "./use-result-queue";

/** Pesan error dari mutasi atau query untuk ditampilkan inline. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Banner kuning selama antrean Time trial belum ada di backend (satu konstanta di domain timetrial). */
function MockBanner() {
  if (!TIMETRIAL_API_IS_MOCK) return null;
  return (
    <p
      role="note"
      className="bg-warning-soft text-event-day-ink rounded-xl px-4 py-3 text-sm font-semibold"
    >
      {TIMETRIAL_MOCK_BANNER}
    </p>
  );
}

/** Kerangka saat antrean dimuat. */
function Loading() {
  return (
    <div className="grid gap-4 p-4 md:p-7 lg:grid-cols-[1fr_320px]" aria-busy>
      <div className="grid gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full max-w-md" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/** Pemberitahuan dengan ikon (belum diundi, antrean kosong), tanpa bergantung pada portal.css. */
function Notice({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-border bg-card mx-auto grid max-w-lg justify-items-center gap-3 rounded-2xl border p-8 text-center">
      <Shuffle size={28} className="text-time-trial" aria-hidden />
      <p className="text-muted-foreground">{message}</p>
      {children}
    </div>
  );
}

/**
 * Kerangka dua kolom layar Run: kiri peserta + timer + tombol, kanan "Best times" dan "Up next".
 * Tablet landscape (lg, 1024px) dua kolom seperti desain; HP satu kolom (kolom kanan di bawah).
 */
function RunLayout({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-7">
      <div className="grid min-w-0 content-start gap-4">{main}</div>
      <aside className="grid min-w-0 content-start gap-2.5">{side}</aside>
    </div>
  );
}

/** Pil teal "Participant k of N" di atas layar (desain: di header). */
function ProgressPill({ queue }: { queue: Queue }) {
  const progress = participantProgress(queue.participants);
  return (
    <span className="bg-time-trial-soft text-time-trial-ink rounded-full px-3 py-1.5 text-[13px] font-bold">
      Participant {progress.position} of {progress.total}
    </span>
  );
}

/**
 * Keadaan antrean selesai: semua peserta DONE, DNS, atau DQ. Dipanggil dari TimeTrialRun.
 * Menampilkan "All participants done" dengan link ke tab Results, dan tetap menampilkan Best times.
 */
function QueueDone({
  competitionId,
  queue,
}: {
  competitionId: string;
  queue: Queue;
}) {
  return (
    <div className="grid gap-4 p-4 md:p-7">
      <MockBanner />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ProgressPill queue={queue} />
      </div>
      <RunLayout
        main={
          <div
            role="status"
            className="bg-success-soft text-done grid gap-3 rounded-2xl p-6"
          >
            <p className="font-display flex items-center gap-2 text-2xl font-bold">
              <CircleCheck size={26} aria-hidden /> All participants done
            </p>
            <p className="text-sm font-semibold">
              Every participant has finished, did not start or was disqualified.
            </p>
            <Link
              href={ROUTES.liveResults(competitionId)}
              className={cn(
                buttonVariants(),
                "min-h-12 w-full rounded-xl text-base sm:w-fit sm:px-6",
              )}
            >
              View results
            </Link>
          </div>
        }
        side={<BestTimesPanel competitionId={competitionId} />}
      />
    </div>
  );
}

/** Gaya tombol besar hijau (desain: #15803D). */
const GREEN_BUTTON =
  "w-full rounded-2xl bg-[#15803d] font-extrabold text-white hover:bg-[#166534]";

/** Gaya tombol sekunder desain: tinggi 52px, sudut 14px. */
const SECONDARY_BUTTON = "min-h-[52px] rounded-[14px] text-[15px] font-bold";

type PrimaryButtonSpec = {
  label: string;
  disabled: boolean;
  onClick: () => void;
  /** Tombol Stop lebih tinggi (min 72px) dan hurufnya lebih besar. */
  stop?: boolean;
};

/**
 * Isi layar Run setelah antrean dimuat dan ada peserta yang sedang giliran. Dipanggil dari
 * `TimeTrialRun` dengan `key` = id peserta, jadi pindah peserta (Next, Skip, DNS, DQ) membuat
 * timer lokal mulai dari nol.
 *
 * State layar:
 * - SERVER (antrean): siapa giliran, attempt, jatah, waktu terbaik, dan flag `actions` (hak + data).
 * - LOKAL: timer (`useRaceTimer`: idle -> countdown -> running -> stopped, jam klien), antrean
 *   hasil offline (`results`, dari induk), dialog, dan pesan error aksi.
 * Fase layar = `phaseOf(...)` dari data server + `countdownActive` lokal. Tombol utama dari
 * `primaryActionOf(phase, actions)`; antrean hasil yang belum tersimpan didahulukan (tampil "Pending").
 * Setelah tiap aksi mutasi menyegarkan antrean (lihat queries.ts).
 */
function RunBoard({
  competitionId,
  queue,
  participant,
  results,
  online,
  clock,
}: {
  competitionId: string;
  queue: Queue;
  participant: QueueParticipant;
  results: ReturnType<typeof useResultQueue>;
  online: boolean;
  clock: Clock;
}) {
  const createAttempt = useCreateAttempt(competitionId);
  const startAttempt = useStartAttempt(competitionId);
  const timeoutAttempt = useTimeoutAttempt(competitionId);
  const retryAttempt = useRetryAttempt(competitionId);
  const undoAttempt = useUndoAttempt(competitionId);
  const completeParticipant = useCompleteParticipant(competitionId);
  const reopenParticipant = useReopenParticipant(competitionId);
  const skipParticipant = useSkipParticipant(competitionId);
  const markDns = useMarkDns(competitionId);
  const disqualify = useDisqualify(competitionId);
  const revokePenalty = useRevokePenalty(competitionId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [timeoutError, setTimeoutError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [dnsOpen, setDnsOpen] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);
  const [dqError, setDqError] = useState<string | null>(null);
  // Attempt yang sedang dimulai (hitung mundur berjalan); dipakai saat hitungan habis.
  const startingAttemptId = useRef<string | null>(null);

  const { rules } = queue;
  const actions = participant.actions;
  const counted = participant.attemptsCounted;

  const timer = useRaceTimer({
    clock,
    cutoffMs: rules.cutoffMs,
    onCountdownDone: handleCountdownDone,
    onCutoff: () => void handleCutoff(),
  });

  // Salinan terbaru untuk handler yang dipanggil belakangan (tombol Undo di toast, cut-off).
  const latest = useRef({ participant, items: results.items });
  useEffect(() => {
    latest.current = { participant, items: results.items };
  });

  const countdownActive = timer.state.kind === "countdown";
  const timerRunning = timer.state.kind === "running";
  const phase = phaseOf({
    drawingLocked: queue.drawingLocked,
    finished: queue.finished,
    participant,
    attemptLimit: rules.attemptLimit,
    countdownActive,
  });
  // Hitung mundur habis dan timer lokal jalan, tetapi server belum mengonfirmasi start.
  const starting = timerRunning && phase === "READY";
  const last = lastCountedAttempt(participant.attempts);
  const pending =
    results.items.find((i) => i.entryId === participant.entryId) ?? null;
  const queueBusy = results.items.length > 0;
  const waiting = waitingResultCount(results.items);
  const readOnly = !Object.values(actions).some(Boolean);
  const busy =
    createAttempt.isPending ||
    startAttempt.isPending ||
    retryAttempt.isPending ||
    undoAttempt.isPending ||
    completeParticipant.isPending ||
    skipParticipant.isPending ||
    markDns.isPending ||
    disqualify.isPending;
  const locked = busy || queueBusy;

  useWakeLock(timerRunning);

  // Resume setelah reload (atau Undo sebelum hasil terkirim): attempt di server RUNNING tetapi
  // timer lokal idle. Waktunya dihitung dari started_at server (jam sistem; lihat isoSpanMs).
  const { resume } = timer;
  const timerKind = timer.state.kind;
  const active = participant.activeAttempt;
  useEffect(() => {
    if (timerKind !== "idle" || !active || active.status !== "RUNNING") return;
    resume(isoSpanMs(active.startedAt, Date.now()) ?? 0);
  }, [timerKind, active, resume]);

  /** Hitung mundur habis (dipanggil hook timer): timer sudah berjalan, kirim POST start. */
  function handleCountdownDone() {
    const id = startingAttemptId.current;
    if (!id) return;
    startAttempt.mutateAsync(id).catch((cause: unknown) => {
      timer.reset();
      setActionError(
        `${messageOf(cause, "Unable to start the attempt.")} Press ${startAttemptLabel(latest.current.participant.attemptsCounted)} to try again.`,
      );
    });
  }

  /** Cut-off tercapai (dipanggil hook timer): attempt dihentikan dengan status TIMEOUT. */
  async function handleCutoff() {
    const attempt = latest.current.participant.activeAttempt;
    if (!attempt) return;
    setTimeoutError(null);
    try {
      await timeoutAttempt.mutateAsync(attempt.id);
      setAnnouncement(
        `Cut-off reached. Attempt ${latest.current.participant.attemptsCounted + 1} counted without a time.`,
      );
    } catch (cause) {
      setTimeoutError(messageOf(cause, "Unable to record the cut-off."));
    }
  }

  /**
   * Start attempt N: buat attempt WAITING (atau pakai yang sudah ada, mis. layar dibuka ulang),
   * lalu hitung mundur sesuai rule. Saat hitungan habis hook timer memanggil `handleCountdownDone`.
   * Timer di-reset dulu supaya hasil attempt sebelumnya hilang dari layar.
   */
  async function handleStartAttempt() {
    setActionError(null);
    try {
      const existing =
        participant.activeAttempt?.status === "WAITING"
          ? participant.activeAttempt
          : null;
      const attempt =
        existing ??
        (await createAttempt.mutateAsync({
          roundId: queue.roundId,
          entryId: participant.entryId,
          attemptNumber: nextAttemptNumber(participant.attempts),
        }));
      startingAttemptId.current = attempt.id;
      timer.reset();
      timer.startCountdown(rules.countdownSeconds);
    } catch (cause) {
      setActionError(
        `${messageOf(cause, "Unable to prepare the attempt.")} Press ${startAttemptLabel(counted)} to try again.`,
      );
    }
  }

  /**
   * Stop satu ketukan. Waktu dibaca dari jam SEBELUM apa pun dikirim (`rawDurationMs` = yang
   * dilihat operator), timer langsung dibekukan, hasil masuk antrean (kirim stop + simpan waktu),
   * dan toast Undo tampil 5 detik.
   */
  function handleStop() {
    const attempt = participant.activeAttempt;
    if (!attempt || !timerRunning) return;
    const rawDurationMs = timer.readElapsed();
    timer.stop(rawDurationMs);
    const label = counted + 1;
    results.submit({
      clientRequestId: newClientRequestId(),
      attemptId: attempt.id,
      entryId: participant.entryId,
      petName: participant.petName,
      attemptLabel: label,
      rawDurationMs,
      stopped: false,
      status: "sending",
      error: null,
    });
    setAnnouncement(
      `${participant.petName} attempt ${label} finished in ${formatTimer(rawDurationMs)}`,
    );
    const entryId = participant.entryId;
    toast(
      `${participant.petName} - attempt ${label}: ${formatTimer(rawDurationMs)}`,
      {
        duration: 5000,
        action: { label: "Undo", onClick: () => void undoLast(entryId) },
      },
    );
  }

  /**
   * Menyimpan ulang waktu attempt yang sudah di-stop di server tetapi waktunya belum tersimpan
   * (fase RESULT_PENDING, mis. setelah reload). Waktu dihitung dari started_at dan stopped_at server.
   */
  function handleRetryResult() {
    const attempt = pendingResultAttempt(participant.attempts);
    if (!attempt) return;
    const rawDurationMs = isoSpanMs(attempt.startedAt, attempt.stoppedAt);
    if (rawDurationMs === null) {
      setActionError(
        "The time of this attempt is unknown. Undo it and run it again.",
      );
      return;
    }
    setActionError(null);
    results.submit({
      clientRequestId: newClientRequestId(),
      attemptId: attempt.id,
      entryId: participant.entryId,
      petName: participant.petName,
      attemptLabel: counted,
      rawDurationMs,
      stopped: true,
      status: "sending",
      error: null,
    });
  }

  /**
   * Undo hasil terakhir (tombol Undo atau toast). Memakai data terbaru dari ref karena toast bisa
   * dipanggil beberapa detik setelah render. Hasil yang belum sampai ke server cukup dibuang
   * (timer lalu menyambung dari started_at server); yang sudah tersimpan dibatalkan di server
   * (status RETRY: jatah kembali, waktunya keluar dari peringkat).
   */
  async function undoLast(entryId: string) {
    const { participant: current, items } = latest.current;
    const queued = items.find((i) => i.entryId === entryId);
    try {
      if (queued) {
        if (queued.status === "sending") {
          toast.info(
            "This result is still being sent. Try Undo again in a moment.",
          );
          return;
        }
        results.discard(queued.clientRequestId);
        timer.reset();
        setAnnouncement(
          `${queued.petName} attempt ${queued.attemptLabel} undone`,
        );
        return;
      }
      if (current.entryId !== entryId) {
        toast.info("Undo is no longer available for this participant.");
        return;
      }
      const target = latestCountedAttempt(current.attempts.map(attemptFacts));
      const attempt = target
        ? current.attempts.find((a) => a.number === target.number)
        : undefined;
      if (!attempt) return;
      await undoAttempt.mutateAsync(attempt.id);
      timer.reset();
      setAnnouncement(`${current.petName} attempt undone`);
    } catch (cause) {
      toast.error(messageOf(cause, "Unable to undo this attempt."));
    }
  }

  /** Retry (false start): batalkan attempt aktif tanpa memakai jatah (keputusan 3A). */
  async function handleRetry() {
    const attempt = participant.activeAttempt;
    if (!attempt) return;
    setActionError(null);
    // Saat hitung mundur timer dihentikan lebih dulu supaya start tidak terkirim untuk attempt yang dibatalkan.
    // Saat berjalan, timer baru di-reset setelah server menjawab (kalau tidak, ia menyambung lagi dari started_at).
    const counting = timer.state.kind === "countdown";
    if (counting) timer.reset();
    try {
      await retryAttempt.mutateAsync({ attemptId: attempt.id });
    } catch (cause) {
      setActionError(messageOf(cause, "Unable to cancel this attempt."));
      return;
    }
    if (!counting) timer.reset();
    setAnnouncement("Attempt cancelled. It does not count.");
  }

  /** Next participant: selesaikan giliran. Toast Undo membuka peserta lagi (reopen). */
  async function handleNext() {
    setActionError(null);
    const { roundEntryId, petName } = participant;
    try {
      await completeParticipant.mutateAsync(roundEntryId);
    } catch (cause) {
      setActionError(messageOf(cause, "Unable to finish this participant."));
      return;
    }
    setAnnouncement(`${petName} done`);
    toast(`${petName} done`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () =>
          void reopenParticipant
            .mutateAsync(roundEntryId)
            .catch((cause: unknown) =>
              toast.error(
                messageOf(cause, "Unable to reopen this participant."),
              ),
            ),
      },
    });
  }

  /** Skip to next: peserta ke akhir antrean (hanya sebelum ada attempt terhitung). */
  async function handleSkip() {
    setActionError(null);
    try {
      await skipParticipant.mutateAsync(participant.entryId);
      setAnnouncement(`${participant.petName} moved to the end of the queue`);
    } catch (cause) {
      setActionError(messageOf(cause, "Unable to skip this participant."));
    }
  }

  /** Did not start (setelah konfirmasi). Toast Undo mengembalikan peserta ke antrean. */
  async function handleDns() {
    setDnsOpen(false);
    setActionError(null);
    const { roundEntryId, petName } = participant;
    try {
      await markDns.mutateAsync({ roundEntryId, dns: true });
    } catch (cause) {
      setActionError(messageOf(cause, "Unable to mark this participant."));
      return;
    }
    setAnnouncement(`${petName} marked as did not start`);
    toast(`${petName} did not start`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () =>
          void markDns
            .mutateAsync({ roundEntryId, dns: false })
            .catch((cause: unknown) =>
              toast.error(messageOf(cause, "Unable to undo this.")),
            ),
      },
    });
  }

  /** Disqualify (dari dialog): alasan wajib. Sukses menutup dialog dan menawarkan Undo (cabut penalti). */
  async function handleDisqualify(target: QueueParticipant, reason: string) {
    setDqError(null);
    try {
      const penalty = await disqualify.mutateAsync({
        entryId: target.entryId,
        reason,
      });
      setDqOpen(false);
      setAnnouncement(`${target.petName} disqualified`);
      toast(`${target.petName} disqualified`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () =>
            void revokePenalty
              .mutateAsync(penalty.id)
              .catch((cause: unknown) =>
                toast.error(
                  messageOf(cause, "Unable to revoke the disqualification."),
                ),
              ),
        },
      });
    } catch (cause) {
      setDqError(messageOf(cause, "Unable to disqualify."));
    }
  }

  // Tombol utama: hasil yang belum tersimpan didahulukan (tidak ada tombol utama), lalu keadaan lokal
  // (Starting, Get ready), lalu `primaryActionOf` dari fase dan flag server.
  const primaryAction = pending ? null : primaryActionOf(phase, actions);
  let primary: PrimaryButtonSpec | null = null;
  if (!readOnly && !pending) {
    if (starting || startAttempt.isPending)
      primary = { label: "Starting...", disabled: true, onClick: () => {} };
    else if (phase === "COUNTDOWN")
      primary = { label: "Get ready", disabled: true, onClick: () => {} };
    else if (primaryAction === "START_ATTEMPT" || primaryAction === "START_NOW")
      primary = {
        label: createAttempt.isPending
          ? "Preparing..."
          : startAttemptLabel(counted),
        disabled: locked,
        onClick: () => void handleStartAttempt(),
      };
    else if (primaryAction === "STOP")
      primary = {
        label: "Stop",
        disabled: !timerRunning,
        onClick: handleStop,
        stop: true,
      };
    else if (primaryAction === "RETRY_RESULT")
      primary = {
        label: "Retry saving time",
        disabled: locked,
        onClick: handleRetryResult,
      };
    else if (primaryAction === "NEXT_PARTICIPANT")
      primary = {
        label: "Next participant",
        disabled: locked,
        onClick: () => void handleNext(),
      };
  }
  const showNextSecondary =
    !readOnly &&
    !pending &&
    phase === "BETWEEN_ATTEMPTS" &&
    actions.nextParticipant;
  const note = last ? rankNote(participant, last.attempt) : null;
  const showResultNote =
    note !== null && (phase === "BETWEEN_ATTEMPTS" || phase === "QUOTA_USED");
  const next = upNext(
    queue.participants,
    queue.currentEntryId,
    UP_NEXT_SIZE,
  )[0];

  return (
    <div className="grid gap-4 p-4 md:p-7">
      <MockBanner />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ProgressPill queue={queue} />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <RunLayout
        main={
          <>
            {!online && (
              <p
                role="status"
                className="bg-danger-soft text-danger-ink flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              >
                <WifiOff size={16} aria-hidden /> You are offline. Results are
                kept here and sent when the connection returns.
              </p>
            )}
            {waiting > 0 && (
              <div
                role="status"
                className="bg-warning-soft text-event-day-ink flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              >
                <span>
                  {waiting} {waiting === 1 ? "result" : "results"} waiting to be
                  sent
                </span>
                <Button
                  variant="secondary"
                  className="min-h-11"
                  disabled={!online}
                  onClick={() => void results.flush()}
                >
                  Retry now
                </Button>
              </div>
            )}
            {results.items
              .filter((item) => item.status === "rejected")
              .map((item) => (
                <RejectedResult
                  key={item.clientRequestId}
                  item={item}
                  onRetry={() => results.retry(item.clientRequestId)}
                  onDiscard={() => {
                    results.discard(item.clientRequestId);
                    timer.reset();
                  }}
                />
              ))}
            {actionError && (
              <p role="alert" className="text-danger-ink text-sm font-semibold">
                {actionError}
              </p>
            )}
            {timeoutError && (
              <div
                role="alert"
                className="bg-danger-soft text-danger-ink flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              >
                <span>{timeoutError}</span>
                <Button
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void handleCutoff()}
                >
                  Retry cut-off
                </Button>
              </div>
            )}

            <ParticipantCard
              participant={participant}
              attemptLimit={rules.attemptLimit}
            />

            <RaceTimerDisplay
              state={timer.state}
              clock={timer.clock}
              label="Attempt timer"
              large
            />
            <p className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  phase === "RUNNING" && !pending
                    ? "bg-success"
                    : phase === "COUNTDOWN"
                      ? "bg-warning"
                      : "bg-[#8a809e]",
                )}
              />
              <span data-testid="timer-status">
                {statusText({
                  phase,
                  starting,
                  pending,
                  countdownSeconds: rules.countdownSeconds,
                  counted,
                  last: last?.attempt ?? null,
                })}
              </span>
            </p>
            <p className="text-muted-foreground">
              Cut-off{" "}
              <span className="font-mono">{formatCutoff(rules.cutoffMs)}</span>
              {last && (
                <>
                  {" - "}attempt {last.ordinal}:{" "}
                  <b className="text-foreground font-mono">
                    {attemptResultText(last.attempt)}
                  </b>
                </>
              )}
            </p>
            {showResultNote && (
              <p data-testid="attempt-note" className="text-sm font-semibold">
                {note}
              </p>
            )}

            {readOnly ? (
              <p role="note" className="text-muted-foreground text-sm">
                You can view this queue but you do not have access to run it
                right now.
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-2.5">
                {primary && (
                  <Button
                    className={cn(
                      GREEN_BUTTON,
                      "col-span-full",
                      primary.stop
                        ? "min-h-[72px] text-2xl"
                        : "min-h-[68px] text-[21px]",
                    )}
                    disabled={primary.disabled}
                    onClick={primary.onClick}
                  >
                    {primary.label}
                  </Button>
                )}
                {showNextSecondary && (
                  <Button
                    variant="secondary"
                    className={cn(SECONDARY_BUTTON, "col-span-full min-h-14")}
                    disabled={locked}
                    onClick={() => void handleNext()}
                  >
                    Next participant
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className={SECONDARY_BUTTON}
                  disabled={!actions.markDns || locked}
                  onClick={() => setDnsOpen(true)}
                >
                  Did not start
                </Button>
                <Button
                  variant="secondary"
                  className={cn(
                    SECONDARY_BUTTON,
                    "border-[#7f1d1d] text-[#b91c1c]",
                  )}
                  disabled={!actions.disqualify || locked}
                  onClick={() => {
                    setDqError(null);
                    setDqOpen(true);
                  }}
                >
                  Disqualify
                </Button>
                <Button
                  variant="secondary"
                  className={SECONDARY_BUTTON}
                  disabled={!actions.skip || locked}
                  onClick={() => void handleSkip()}
                >
                  Skip to next
                </Button>
                {actions.retry && !pending && (
                  <Button
                    variant="secondary"
                    className={SECONDARY_BUTTON}
                    disabled={locked}
                    onClick={() => void handleRetry()}
                  >
                    Retry (false start)
                  </Button>
                )}
                {actions.undo && !pending && (
                  <Button
                    variant="secondary"
                    className={SECONDARY_BUTTON}
                    disabled={locked}
                    onClick={() => void undoLast(participant.entryId)}
                  >
                    Undo last result
                  </Button>
                )}
              </div>
            )}
          </>
        }
        side={
          <>
            <BestTimesPanel competitionId={competitionId} />
            <UpNextPanel next={next ?? null} />
          </>
        }
      />

      <ConfirmActionDialog
        open={dnsOpen}
        onOpenChange={setDnsOpen}
        title={`${participant.petName} did not start?`}
        description="The participant leaves the queue without a time. You can undo this for a few seconds right after."
        confirmLabel="Did not start"
        danger
        busy={markDns.isPending}
        onConfirm={() => void handleDns()}
      />
      <DisqualifyDialog
        lane={dqOpen ? participant : null}
        onOpenChange={(open) => !open && setDqOpen(false)}
        busy={disqualify.isPending}
        error={dqError}
        onConfirm={(target, reason) => void handleDisqualify(target, reason)}
        description="The participant is removed from the ranking and the queue. You can undo this for a few seconds right after."
      />
    </div>
  );
}

/**
 * Hasil waktu yang ditolak server (bukan masalah jaringan): pesan + Retry (kirim ulang dengan id
 * yang sama) dan Discard (buang). Dipanggil dari RunBoard.
 */
function RejectedResult({
  item,
  onRetry,
  onDiscard,
}: {
  item: PendingResult;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="alert"
      className="bg-danger-soft text-danger-ink grid gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
    >
      <span>
        {item.petName}, attempt {item.attemptLabel}:{" "}
        {item.error ?? "Not saved."}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="min-h-11" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}

/**
 * Layar Run Time trial (langkah 2). Dipanggil dari `LiveMatches` untuk kompetisi TIME_TRIAL.
 * Memuat antrean; 403 -> "No access", 404 -> tidak ditemukan, error lain -> kartu error dengan
 * "Try again". Undian belum di-lock -> link ke tab Running order. Semua peserta selesai -> "All
 * participants done". Selain itu RunBoard untuk peserta yang sedang giliran.
 * Antrean hasil offline hidup di sini (bukan di RunBoard) supaya tidak hilang saat peserta berganti.
 * `clock` hanya untuk tes (bawaan `performance.now`).
 */
export function TimeTrialRun({
  competitionId,
  clock = performanceClock,
}: {
  competitionId: string;
  clock?: Clock;
}) {
  const queue = useQueue(competitionId);
  const online = useOnlineStatus();
  const stopAttempt = useStopAttempt(competitionId);
  const recordResult = useRecordResult(competitionId);
  const results = useResultQueue({
    online,
    send: stopAttempt.mutateAsync,
    record: recordResult.mutateAsync,
  });

  if (queue.isError && !queue.data) {
    if (queue.error instanceof ApiError && queue.error.status === 403)
      return <Forbidden />;
    const notFound =
      queue.error instanceof ApiError && queue.error.status === 404;
    return (
      <div className="grid gap-4 p-4 md:p-7">
        <ErrorState
          error={queue.error}
          fallback={
            notFound
              ? "This competition was not found."
              : "Unable to load the queue."
          }
          onRetry={notFound ? undefined : () => void queue.refetch()}
        />
      </div>
    );
  }
  if (!queue.data) return <Loading />;

  const data = queue.data;
  if (!data.drawingLocked)
    return (
      <div className="grid gap-4 p-4 md:p-7">
        <MockBanner />
        <Notice message="The running order is not locked yet, so nobody can run. Draw and lock the running order first.">
          <Link
            href={ROUTES.liveDrawing(competitionId)}
            className={cn(buttonVariants(), "min-h-12 rounded-xl px-5")}
          >
            Go to Running order
          </Link>
        </Notice>
      </div>
    );
  if (data.participants.length === 0)
    return (
      <div className="grid gap-4 p-4 md:p-7">
        <Notice message="Nobody is in the queue." />
      </div>
    );

  const current = data.finished
    ? null
    : (data.participants.find((p) => p.entryId === data.currentEntryId) ??
      null);
  if (!current) return <QueueDone competitionId={competitionId} queue={data} />;
  return (
    <RunBoard
      key={current.entryId}
      competitionId={competitionId}
      queue={data}
      participant={current}
      results={results}
      online={online}
      clock={clock}
    />
  );
}
