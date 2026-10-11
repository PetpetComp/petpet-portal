"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { newClientRequestId } from "@/domains/matches/api";
import {
  MATCHES_API_IS_MOCK,
  MATCHES_MOCK_BANNER,
} from "@/domains/matches/constants";
import {
  effectiveMatchActions,
  laneActionAllowed,
  phaseOf,
} from "@/domains/matches/phase";
import {
  useAssignFinish,
  useCaptureFinish,
  useConfirmMatch,
  useCreateSession,
  useDisqualify,
  useMarkDns,
  useMatch,
  useMatches,
  useRematch,
  useRevokePenalty,
  useStartSession,
  useStopSession,
  useVoidFinish,
} from "@/domains/matches/queries";
import {
  allLanesResolved,
  laneInputsFromMatch,
  matchOutcomes,
} from "@/domains/matches/rank";
import {
  formatCutoff,
  formatTimer,
  nextSessionNumber,
  performanceClock,
  type Clock,
} from "@/domains/matches/time";
import { matchKeys } from "@/domains/matches/keys";
import type {
  Match,
  MatchLane,
  MatchList,
  StopReason,
} from "@/domains/matches/types";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { useOnlineStatus } from "../live-connection";
import {
  waitingCount,
  nextOrderWithQueue,
  type PendingFinish,
} from "./finish-queue";
import { laneView } from "./lane-view";
import { isoSpanMs } from "./race-timer";
import {
  ConfirmActionDialog,
  ConfirmSummaryDialog,
  DisqualifyDialog,
} from "./run-dialogs";
import { RunLaneCard, type LaneAllowance } from "./run-lane-card";
import { RunTimerPanel, statusLineText } from "./run-timer-panel";
import { useFinishQueue } from "./use-finish-queue";
import { useRaceTimer } from "./use-race-timer";
import { useWakeLock } from "./use-wake-lock";

/** Pesan error dari mutasi atau query untuk ditampilkan inline. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Banner kuning selama endpoint Run Match belum ada di backend (satu konstanta di domain matches). */
export function MatchesMockBanner() {
  if (!MATCHES_API_IS_MOCK) return null;
  return (
    <p
      role="note"
      className="bg-warning-soft text-event-day-ink rounded-xl px-4 py-3 text-sm font-semibold"
    >
      {MATCHES_MOCK_BANNER}
    </p>
  );
}

/** Kerangka saat match dimuat. */
function Loading() {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 md:p-7" aria-busy>
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

/**
 * Isi layar Run Match setelah match berhasil dimuat. Dipanggil dari `RunMatch`.
 * Memegang semua state layar: timer klien, antrean finish, dialog, dan pesan error aksi.
 * Alur: server menentukan HAK dan KEADAAN (`match.actions`, `lane.actions`), layar menambah
 * batasan fase (`phaseOf`) dan jam klien (timer). Setelah tiap aksi mutasi menyegarkan match.
 */
function RunMatchView({
  competitionId,
  match,
  clock,
}: {
  competitionId: string;
  match: Match;
  clock: Clock;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const client = useQueryClient();
  // Daftar match dijaga aktif supaya tersegarkan setelah Confirm (dibaca lewat cache).
  useMatches(competitionId);
  const createSession = useCreateSession(match.id);
  const startSession = useStartSession(match.id);
  const stopSession = useStopSession(match.id);
  const captureFinish = useCaptureFinish(match.id);
  const assignFinish = useAssignFinish(match.id);
  const voidFinish = useVoidFinish(match.id);
  const rematch = useRematch(match.id);
  const markDns = useMarkDns(match.id);
  const disqualify = useDisqualify(match.id);
  const revokePenalty = useRevokePenalty(match.id);
  const confirm = useConfirmMatch(match.id, competitionId);

  const session = match.currentSession;
  const defaults = match.sessionDefaults;
  const cutoffMs = session?.cutoffTimeMs ?? defaults.cutoffTimeMs;

  const [actionError, setActionError] = useState<string | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [rematchOpen, setRematchOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [dqLane, setDqLane] = useState<MatchLane | null>(null);
  const [dqError, setDqError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  // Id sesi yang sedang dimulai dan alasan stop terakhir (untuk "Retry stop").
  const startSessionId = useRef<string | null>(null);
  const lastStopReason = useRef<StopReason>("MANUAL");
  const stopInFlight = useRef(false);

  const queue = useFinishQueue({
    online,
    capture: captureFinish.mutateAsync,
    assign: assignFinish.mutateAsync,
  });

  const timer = useRaceTimer({
    clock,
    cutoffMs,
    onCountdownDone: handleCountdownDone,
    onCutoff: () => void requestStop("CUTOFF"),
  });

  // Salinan terbaru untuk handler yang dipanggil belakangan (tombol Undo di toast).
  const latest = useRef({ match, items: queue.items });
  useEffect(() => {
    latest.current = { match, items: queue.items };
  });

  const countdownActive = timer.state.kind === "countdown";
  const phase = phaseOf(
    match.heatStatus,
    session?.status ?? null,
    countdownActive,
  );
  const timerRunning = timer.state.kind === "running";
  // Hitung mundur habis dan timer lokal jalan, tetapi server belum mengonfirmasi start.
  const starting = timerRunning && phase === "READY";
  const actions = effectiveMatchActions(match.actions, phase);
  const readOnly =
    phase !== "DONE" && !Object.values(match.actions).some(Boolean);
  const outcomes = matchOutcomes(match);
  const laneInputs = laneInputsFromMatch(match);
  const resolved = allLanesResolved(laneInputs);

  useWakeLock(timerRunning);

  // Resume setelah reload: sesi di server RUNNING / sudah berhenti tetapi timer lokal masih idle.
  // Waktunya dihitung dari started_at server (jam sistem, bukan performance.now; lihat isoSpanMs).
  const { resume, showStopped } = timer;
  const timerKind = timer.state.kind;
  useEffect(() => {
    if (timerKind !== "idle" || !session) return;
    if (session.status === "RUNNING")
      resume(isoSpanMs(session.startedAt, Date.now()) ?? 0);
    else if (session.status === "FINISHED" || session.status === "CUTOFF")
      showStopped(isoSpanMs(session.startedAt, session.stoppedAt) ?? 0);
  }, [timerKind, session, resume, showStopped]);

  // Semua lane sudah punya keputusan dan tidak ada finish yang masih di antrean: stop otomatis.
  const lastFinishMs = laneInputs.reduce(
    (max, lane) => Math.max(max, lane.finishTimeMs ?? 0),
    0,
  );
  useEffect(() => {
    if (phase !== "RUNNING" || timerKind !== "running") return;
    if (!resolved || queue.items.length > 0 || !match.actions.stop) return;
    timer.stop(lastFinishMs);
    void requestStop("ALL_FINISHED");
  });

  /** Hitung mundur habis (dipanggil hook timer): timer sudah berjalan, kirim POST start. */
  function handleCountdownDone() {
    const id = startSessionId.current;
    if (!id) return;
    startSession.mutateAsync(id).catch((cause: unknown) => {
      timer.reset();
      setActionError(
        `${messageOf(cause, "Unable to start the match.")} Press Start match to try again.`,
      );
    });
  }

  /** Menghentikan sesi di server dengan satu alasan. Gagal: pesan + tombol "Retry stop". */
  async function requestStop(reason: StopReason) {
    const id = latest.current.match.currentSession?.id;
    if (!id || stopInFlight.current) return;
    stopInFlight.current = true;
    lastStopReason.current = reason;
    setStopError(null);
    try {
      await stopSession.mutateAsync({ sessionId: id, reason });
    } catch (cause) {
      setStopError(messageOf(cause, "Unable to stop the match."));
    } finally {
      stopInFlight.current = false;
    }
  }

  /**
   * Start match: buat sesi bila belum ada (nilai bawaan dari rule), lalu hitung mundur.
   * Saat hitung mundur habis hook timer memanggil `handleCountdownDone`.
   */
  async function handleStart() {
    setActionError(null);
    try {
      let target = session?.status === "READY" ? session : null;
      if (!target)
        target = await createSession.mutateAsync({
          sessionNumber: nextSessionNumber(match.sessions),
          countdownSeconds: defaults.countdownSeconds,
          cutoffTimeMs: defaults.cutoffTimeMs,
        });
      startSessionId.current = target.id;
      timer.startCountdown(target.countdownSeconds);
    } catch (cause) {
      setActionError(
        `${messageOf(cause, "Unable to prepare the match.")} Press Start match to try again.`,
      );
    }
  }

  /** Stop manual (setelah konfirmasi): timer dibekukan sekarang, alasan MANUAL. */
  function handleManualStop() {
    setStopOpen(false);
    timer.stop();
    void requestStop("MANUAL");
  }

  /**
   * Finish satu ketukan di satu lane. Waktu dibaca dari jam SEBELUM apa pun dikirim
   * (`captured_time_ms` = yang dilihat operator). Lane langsung tampil selesai (optimistic),
   * request berjalan lewat antrean, dan toast Undo tampil 5 detik.
   */
  function handleFinish(lane: MatchLane) {
    if (!session || !timerRunning) return;
    const capturedTimeMs = timer.readElapsed();
    const item: PendingFinish = {
      clientRequestId: newClientRequestId(),
      sessionId: session.id,
      entryId: lane.entryId,
      laneNumber: lane.laneNumber,
      petName: lane.petName,
      finishOrder: nextOrderWithQueue(
        session.captures,
        queue.items,
        session.id,
      ),
      capturedTimeMs,
      status: "sending",
      capture: null,
      error: null,
    };
    queue.submit(item);
    setAnnouncement(
      `${lane.petName} finished lane ${lane.laneNumber} in ${formatTimer(capturedTimeMs)}`,
    );
    toast(`${lane.petName} finished`, {
      duration: 5000,
      action: { label: "Undo", onClick: () => void undoFinish(lane.entryId) },
    });
  }

  /**
   * Undo finish satu lane (tombol Undo di lane atau di toast). Memakai data terbaru dari ref
   * karena toast bisa dipanggil beberapa detik setelah render. Item antrean yang belum sampai
   * ke server cukup dibuang; item "unassigned" di-void dulu; selain itu void finish di server.
   */
  async function undoFinish(entryId: string) {
    const { match: current, items } = latest.current;
    const pending = items.find((i) => i.entryId === entryId);
    try {
      if (pending) {
        if (pending.status === "sending") {
          toast.info(
            "This finish is still being sent. Try Undo again in a moment.",
          );
          return;
        }
        if (pending.status === "unassigned" && pending.capture)
          await voidFinish.mutateAsync(pending.capture.id);
        queue.discard(pending.clientRequestId);
        return;
      }
      const lane = current.lanes.find((l) => l.entryId === entryId);
      if (!lane?.finish) return;
      await voidFinish.mutateAsync(lane.finish.captureId);
      setAnnouncement(`${lane.petName} finish removed`);
    } catch (cause) {
      toast.error(messageOf(cause, "Unable to undo this finish."));
    }
  }

  /** Menjalankan satu aksi mutasi; gagal menampilkan pesan inline. Mengembalikan true bila sukses. */
  async function runAction(action: () => Promise<unknown>, fallback: string) {
    setActionError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setActionError(messageOf(cause, fallback));
      return false;
    }
  }

  /** Rematch (setelah konfirmasi): sesi baru dari sesi sekarang, timer dan antrean dikosongkan. */
  async function handleRematch() {
    setRematchOpen(false);
    if (!session) return;
    const ok = await runAction(
      () =>
        rematch.mutateAsync({
          sessionNumber: nextSessionNumber(match.sessions),
          countdownSeconds: session.countdownSeconds,
          cutoffTimeMs: session.cutoffTimeMs,
          rematchOfSessionId: session.id,
        }),
      "Unable to start a rematch.",
    );
    if (!ok) return;
    timer.reset();
    queue.clear();
    startSessionId.current = null;
    setStopError(null);
    setAnnouncement("");
  }

  /** Disqualify (dari dialog): alasan wajib. Sukses menutup dialog; gagal menampilkan pesan di dialog. */
  async function handleDisqualify(lane: MatchLane, reason: string) {
    setDqError(null);
    try {
      await disqualify.mutateAsync({ entryId: lane.entryId, reason });
      setDqLane(null);
    } catch (cause) {
      setDqError(messageOf(cause, "Unable to disqualify."));
    }
  }

  /**
   * Confirm result: kirim hasil sementara. Sukses: bila masih ada match berikutnya kembali ke
   * tab Matches (yang berikutnya disorot); bila tidak, kartu sukses dengan link ke Results.
   * Daftar match dibaca langsung dari cache (sudah disegarkan oleh `useConfirmMatch`), bukan dari
   * state render yang bisa tertinggal satu frame.
   */
  async function handleConfirm() {
    setConfirmError(null);
    try {
      await confirm.mutateAsync(outcomes);
    } catch (cause) {
      setConfirmError(messageOf(cause, "Unable to confirm the result."));
      return;
    }
    setConfirmOpen(false);
    toast.success(`Match ${match.number} confirmed`);
    const fresh = client.getQueryData<MatchList>(matchKeys.list(competitionId));
    if (!fresh || fresh.nextMatchId)
      router.push(ROUTES.liveMatches(competitionId));
    else setAllDone(true);
  }

  const busy =
    createSession.isPending || startSession.isPending || rematch.isPending;
  const pendingByEntry = new Map(queue.items.map((i) => [i.entryId, i]));
  const waiting = waitingCount(queue.items);

  /** Hak satu lane: flag server digabung batasan fase dan timer lokal. */
  function allowanceFor(lane: MatchLane, chipEmpty: boolean): LaneAllowance {
    const pending = pendingByEntry.has(lane.entryId);
    const preStart = phase === "IDLE" || phase === "READY";
    const editable = phase !== "DONE" && phase !== "COUNTDOWN";
    return {
      finish:
        lane.actions.finish &&
        laneActionAllowed(phase, "finish") &&
        timerRunning &&
        !pending,
      showFinish: phase !== "DONE" && chipEmpty && !pending,
      undoFinish:
        lane.actions.undoFinish && laneActionAllowed(phase, "undoFinish"),
      markDns:
        lane.actions.markDns && laneActionAllowed(phase, "markDns") && preStart,
      undoDns: lane.actions.undoDns && editable,
      disqualify:
        lane.actions.disqualify && laneActionAllowed(phase, "disqualify"),
      undoDisqualify: lane.actions.undoDisqualify && editable,
    };
  }

  const startEnabled =
    !busy &&
    !starting &&
    ((phase === "IDLE" && actions.createSession) ||
      (phase === "READY" && actions.start));
  const showStart =
    phase === "IDLE" || phase === "READY" || phase === "COUNTDOWN";

  return (
    <div className="grid gap-4 p-4 md:p-7">
      <MatchesMockBanner />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link
          href={ROUTES.liveMatches(competitionId)}
          className="text-primary-dark inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
        >
          <ChevronLeft size={16} aria-hidden /> Matches
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-event-day-soft text-event-day-ink rounded-full px-3.5 py-1.5 text-[13px] font-bold">
            Round 1 - Match {match.number}/{match.totalMatches}
          </span>
          <span className="text-muted-foreground text-[13px]">
            Cut-off{" "}
            <b className="text-foreground font-mono">
              {formatCutoff(cutoffMs)}
            </b>
          </span>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="grid gap-5 md:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] md:items-start md:gap-7">
        <div className="grid min-w-0 content-start gap-3 md:sticky md:top-4">
          <RunTimerPanel
            timerState={timer.state}
            clock={timer.clock}
            phase={phase}
            statusLine={statusLineText(
              phase,
              starting,
              session?.countdownSeconds ?? defaults.countdownSeconds,
              session?.stopReason ?? null,
            )}
            start={
              showStart && !readOnly
                ? {
                    enabled: startEnabled,
                    label:
                      phase === "COUNTDOWN"
                        ? "Get ready"
                        : starting || busy
                          ? "Starting..."
                          : "Start match",
                    onClick: () => void handleStart(),
                  }
                : null
            }
            stop={
              phase === "RUNNING" && !readOnly
                ? {
                    enabled: actions.stop && timerRunning,
                    onClick: () => setStopOpen(true),
                  }
                : null
            }
            rematch={
              phase === "DONE" || readOnly
                ? null
                : {
                    enabled: actions.rematch && !busy,
                    onClick: () => setRematchOpen(true),
                  }
            }
            confirm={
              phase === "DONE" || readOnly
                ? null
                : {
                    enabled:
                      actions.confirm &&
                      queue.items.length === 0 &&
                      !confirm.isPending,
                    busy: confirm.isPending,
                    onClick: () => {
                      setConfirmError(null);
                      setConfirmOpen(true);
                    },
                  }
            }
            footer={
              <>
                {readOnly && (
                  <p role="note" className="text-muted-foreground text-sm">
                    You can view this match but you do not have access to run
                    it.
                  </p>
                )}
                {phase === "DONE" && (
                  <p role="note" className="text-muted-foreground text-sm">
                    This match is confirmed. The result is read-only.
                  </p>
                )}
                {phase === "DONE" && (
                  <Link
                    href={ROUTES.liveMatches(competitionId)}
                    className={buttonVariants({
                      variant: "secondary",
                      className: "min-h-12 w-full rounded-xl",
                    })}
                  >
                    Back to matches
                  </Link>
                )}
                {allDone && (
                  <div
                    role="status"
                    className="bg-success-soft text-done grid gap-2 rounded-xl p-4 text-sm font-semibold"
                  >
                    <p>All matches are done. The final ranking is ready.</p>
                    <Link
                      href={ROUTES.liveResults(competitionId)}
                      className={buttonVariants({
                        className: "min-h-12 w-full rounded-xl",
                      })}
                    >
                      View results
                    </Link>
                  </div>
                )}
              </>
            }
          />
        </div>

        <div className="grid min-w-0 content-start gap-3">
          {!online && (
            <p
              role="status"
              className="bg-danger-soft text-danger-ink flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <WifiOff size={16} aria-hidden /> You are offline. Finishes are
              kept here and sent when the connection returns.
            </p>
          )}
          {waiting > 0 && (
            <div
              role="status"
              className="bg-warning-soft text-event-day-ink flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <span>
                {waiting} {waiting === 1 ? "finish" : "finishes"} waiting to be
                sent
              </span>
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={!online}
                onClick={() => void queue.flush()}
              >
                Retry now
              </Button>
            </div>
          )}
          {actionError && (
            <p role="alert" className="text-danger-ink text-sm font-semibold">
              {actionError}
            </p>
          )}
          {stopError && (
            <div
              role="alert"
              className="bg-danger-soft text-danger-ink flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <span>{stopError}</span>
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => void requestStop(lastStopReason.current)}
              >
                Retry stop
              </Button>
            </div>
          )}
          {match.lanes.map((lane) => {
            const pending = pendingByEntry.get(lane.entryId) ?? null;
            const outcome =
              outcomes.find((o) => o.heatEntryId === lane.heatEntryId) ?? null;
            const view = laneView(lane, pending, outcome, phase);
            return (
              <RunLaneCard
                key={lane.heatEntryId}
                lane={lane}
                view={view}
                pending={pending}
                busy={voidFinish.isPending || markDns.isPending}
                allow={allowanceFor(
                  lane,
                  view.chip === null && !lane.disqualification,
                )}
                handlers={{
                  onFinish: () => handleFinish(lane),
                  onUndo: () => void undoFinish(lane.entryId),
                  onRetry: () =>
                    pending && queue.retry(pending.clientRequestId),
                  onDiscard: () =>
                    pending && queue.discard(pending.clientRequestId),
                  onMarkDns: () =>
                    void runAction(
                      () =>
                        markDns.mutateAsync({
                          heatEntryId: lane.heatEntryId,
                          dns: true,
                        }),
                      "Unable to mark this lane.",
                    ),
                  onUndoDns: () =>
                    void runAction(
                      () =>
                        markDns.mutateAsync({
                          heatEntryId: lane.heatEntryId,
                          dns: false,
                        }),
                      "Unable to update this lane.",
                    ),
                  onDisqualify: () => {
                    setDqError(null);
                    setDqLane(lane);
                  },
                  onUndoDisqualify: () => {
                    const penalty = lane.disqualification;
                    if (penalty)
                      void runAction(
                        () => revokePenalty.mutateAsync(penalty.id),
                        "Unable to revoke the disqualification.",
                      );
                  },
                }}
              />
            );
          })}
        </div>
      </div>

      <ConfirmActionDialog
        open={rematchOpen}
        onOpenChange={setRematchOpen}
        title="Rematch"
        description="Discard this run and start again? Finishes of this run are not counted. Did not start and disqualifications stay."
        confirmLabel="Discard and rematch"
        danger
        onConfirm={() => void handleRematch()}
      />
      <ConfirmActionDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Stop the match?"
        description="Lanes without a finish will be marked DNF."
        confirmLabel="Stop match"
        danger
        onConfirm={handleManualStop}
      />
      <DisqualifyDialog
        lane={dqLane}
        onOpenChange={(open) => !open && setDqLane(null)}
        busy={disqualify.isPending}
        error={dqError}
        onConfirm={(lane, reason) => void handleDisqualify(lane, reason)}
      />
      <ConfirmSummaryDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        lanes={match.lanes}
        outcomes={outcomes}
        busy={confirm.isPending}
        error={confirmError}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}

/**
 * Layar Run Match Live Mode (langkah 2, satu match). Dipanggil dari `matches/[matchId]/page.tsx`.
 * Memuat match; 403 -> "No access", 404 -> tidak ditemukan, error lain -> kartu error dengan
 * "Try again". `clock` hanya untuk tes (bawaan `performance.now`).
 */
export function RunMatch({
  competitionId,
  matchId,
  clock = performanceClock,
}: {
  competitionId: string;
  matchId: string;
  clock?: Clock;
}) {
  const match = useMatch(matchId);

  if (match.isError && !match.data) {
    if (match.error instanceof ApiError && match.error.status === 403)
      return <Forbidden />;
    const notFound =
      match.error instanceof ApiError && match.error.status === 404;
    return (
      <div className="grid gap-4 p-4 md:p-7">
        <ErrorState
          error={match.error}
          fallback={
            notFound
              ? "This match was not found."
              : "Unable to load this match."
          }
          onRetry={notFound ? undefined : () => void match.refetch()}
        />
        <Link
          href={ROUTES.liveMatches(competitionId)}
          className="text-primary text-center font-semibold"
        >
          Back to matches
        </Link>
      </div>
    );
  }
  if (!match.data) return <Loading />;
  return (
    <RunMatchView
      key={match.data.id}
      competitionId={competitionId}
      match={match.data}
      clock={clock}
    />
  );
}
