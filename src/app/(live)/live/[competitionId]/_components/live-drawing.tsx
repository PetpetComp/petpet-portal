"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Shuffle, Users } from "lucide-react";
import { toast } from "sonner";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetition,
  useCompetitionTypes,
} from "@/domains/competitions/queries";
import {
  DRAWING_API_IS_MOCK,
  DRAWING_MOCK_BANNER,
  DRAWING_UNSUPPORTED_MESSAGE,
  isDrawableType,
  isQueueType,
} from "@/domains/drawing/constants";
import {
  buildDrawing,
  buildQueue,
  draftMatches,
  matchSizes,
  queueLaneCount,
} from "@/domains/drawing/draw";
import {
  useDrawing,
  useLockDrawing,
  useSwapDrawing,
} from "@/domains/drawing/queries";
import {
  DRAWING_BLOCKED_LABEL,
  type CompetitionDrawing,
  type DrawingMatch,
} from "@/domains/drawing/types";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { matchOffsets } from "./draw-reveal";
import { DrawingArenaPreview } from "./drawing-arena-preview";
import { DrawingMatchCard } from "./drawing-match-card";
import {
  buildAssignments,
  type Assignment,
  DrawingParticipantsPanel,
} from "./drawing-participants-panel";
import { useDrawReveal } from "./use-draw-reveal";
import { useOnlineStatus } from "./live-connection";
import { isJudgingTypeCode } from "./live-family";

/** Banner kuning selama API drawing masih mock; dimatikan lewat satu konstanta di domain drawing. */
function MockBanner() {
  if (!DRAWING_API_IS_MOCK) return null;
  return (
    <p
      role="note"
      className="bg-warning-soft text-event-day-ink rounded-xl px-4 py-3 text-sm font-semibold"
    >
      {DRAWING_MOCK_BANNER}
    </p>
  );
}

/** Kartu angka kecil (checked in, lanes, matches; Time trial: checked in, in the queue). Di xl menjadi chip satu baris di toolbar. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card grid content-start rounded-2xl p-3.5 xl:flex xl:items-baseline xl:gap-2 xl:rounded-xl xl:px-3.5 xl:py-2">
      <b className="font-display text-3xl leading-9 xl:text-2xl xl:leading-8">
        {value}
      </b>
      <span className="text-muted-foreground text-[13px]">{label}</span>
    </div>
  );
}

/** Pemberitahuan kosong/informasi dengan ikon, tanpa bergantung pada portal.css. */
function LiveNotice({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-border bg-card grid justify-items-center gap-3 rounded-2xl border p-8 text-center">
      <Users size={28} className="text-primary-dark" aria-hidden />
      <p className="text-muted-foreground max-w-md">{message}</p>
      {children}
    </div>
  );
}

/**
 * Kerangka layar Drawing. Dipanggil dari DraftDrawing dan LockedDrawing.
 * xl ke atas: toolbar satu baris penuh lebar yang menempel di atas (statistik + intro di kiri,
 * tombol rata kanan), lalu dua kolom: kartu match + Arena preview, dan panel Participants (340px, menempel).
 * md sampai xl: dua kolom (kiri: statistik + tombol; kanan: kartu), panel di bawah kartu.
 * HP: satu kolom; statistik, kartu, panel, lalu bar tombol yang menempel di dasar layar.
 * `stats` berisi dua kartu (Time trial) atau tiga (Race). Urutan DOM: toolbar (stats+intro, tombol), kartu, panel. Di HP pembungkus toolbar memakai
 * `contents` supaya tombol bisa dipindah ke akhir lewat `order`. Pembungkus `body` memakai
 * `contents` di bawah xl agar kartu dan panel tetap jadi item grid md; di xl ia menjadi grid dua kolom
 * (toolbar harus saudara, bukan item grid yang sama, supaya `sticky` berlaku sepanjang halaman).
 */
function DrawingLayout({
  stats,
  intro,
  actions,
  panel,
  children,
}: {
  stats: { value: number; label: string }[];
  intro: ReactNode;
  actions: ReactNode;
  panel: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-6 md:gap-y-4 md:p-7 xl:flex xl:flex-col">
      <div className="xl:bg-background xl:border-border grid content-start gap-4 max-md:contents md:col-start-1 md:row-span-2 md:row-start-1 xl:sticky xl:top-0 xl:z-20 xl:-mx-7 xl:-mt-7 xl:flex xl:items-center xl:justify-between xl:gap-6 xl:border-b xl:px-7 xl:py-3 xl:shadow-sm">
        <div className="grid content-start gap-4 xl:flex xl:min-w-0 xl:flex-1 xl:items-center xl:gap-5">
          <div
            className={cn(
              "grid gap-2.5 xl:flex xl:shrink-0 xl:gap-2",
              stats.length === 2 ? "grid-cols-2" : "grid-cols-3",
            )}
          >
            {stats.map((stat) => (
              <Stat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>
          <div className="text-muted-foreground grid gap-3 leading-[21px] xl:max-w-xl xl:gap-1 xl:text-[13px] xl:leading-[18px]">
            {intro}
          </div>
        </div>
        <div
          className={cn(
            "grid content-start gap-2.5",
            "max-md:border-border max-md:bg-card max-md:sticky max-md:bottom-0 max-md:z-10 max-md:order-last max-md:-mx-4 max-md:border-t max-md:p-3",
            "xl:flex xl:max-w-2xl xl:flex-wrap xl:items-center xl:justify-end xl:gap-2",
          )}
        >
          {actions}
        </div>
      </div>
      <div className="contents xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-6">
        <div className="grid min-w-0 content-start gap-3 md:col-start-2 md:row-start-1 xl:col-start-1">
          {children}
        </div>
        <div className="min-w-0 md:col-start-2 md:row-start-2 xl:sticky xl:top-24 xl:col-start-2 xl:row-start-1 xl:self-start">
          {panel}
        </div>
      </div>
    </div>
  );
}

/** Grid kartu match: sebanyak yang muat, tiap kartu minimal 260px (satu kolom di HP 375). */
function MatchGrid({
  busy = false,
  children,
}: {
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-busy={busy}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] content-start gap-3"
    >
      {children}
    </div>
  );
}

/** Pesan error dari mutation (Lock/Swap) untuk ditampilkan inline. */
function mutationMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Kerangka match sebelum undian pertama: jumlah dan ukuran match sama dengan yang akan
 * dihasilkan `buildDrawing` (lewat `matchSizes`), tetapi tanpa peserta (nama kosong).
 * Dipanggil dari DraftDrawing saat fase "pending". Id entry palsu tidak pernah ditampilkan.
 */
function plannedMatches(
  participantCount: number,
  lanes: number,
): DrawingMatch[] {
  return matchSizes(participantCount, lanes).map((size, index) => ({
    id: `planned-${index + 1}`,
    number: index + 1,
    status: "SCHEDULED",
    lanes: Array.from({ length: size }, (_, laneIndex) => ({
      entryId: `planned-${index + 1}-${laneIndex + 1}`,
      petName: "",
      ownerName: "",
      bibNumber: "",
      laneNumber: laneIndex + 1,
    })),
  }));
}

/**
 * Drawing yang belum di-lock: draf acak di sisi klien dari peserta yang berhak (keputusan 2A,
 * hanya Lock yang menyimpan). Dipanggil dari LiveDrawing saat status NOT_DRAWN.
 * Fase "pending" (draft = null): hanya kerangka match dengan "?", tombol "Start drawing",
 * Lock nonaktif. Start drawing mengundi dan memutar reveal; sesudahnya fase "drawn".
 * Bila peserta/lane berubah, LiveDrawing me-remount komponen ini (key) sehingga kembali ke pending.
 * Shuffle again mengundi ulang; Lock mengirim susunan entry id ke API lalu pindah ke tab Matches.
 * Tombol Lock mengikuti `actions.lock` dan `lock_blocked_reason` dari API, bukan aturan di sini.
 * `queue` = Time trial: undiannya SATU antrean ("Running order", posisi 1..N, `buildQueue`) tanpa
 * lane, match, dan Arena; alur reveal, Shuffle, dan Lock sama persis dengan Race. Lock lalu pindah
 * ke tab Run (rute yang sama dengan tab Matches).
 */
function DraftDrawing({
  competitionId,
  drawing,
  queue,
}: {
  competitionId: string;
  drawing: CompetitionDrawing;
  queue: boolean;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const lock = useLockDrawing(competitionId);
  const { participants, lanes } = drawing;
  const entryIds = participants.map((p) => p.entryId);
  // null = belum diundi (fase pending); array = hasil undian terakhir (fase drawn).
  const [draft, setDraft] = useState<string[][] | null>(null);
  const pending = draft === null;
  const matches = useMemo(
    () =>
      draft
        ? draftMatches(participants, draft)
        : plannedMatches(
            participants.length,
            queue ? queueLaneCount(participants.length) : lanes,
          ),
    [participants, lanes, draft, queue],
  );

  const reveal = useDrawReveal(participants.length);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewNumber, setPreviewNumber] = useState(1);
  const offsets = useMemo(
    () => matchOffsets(matches.map((m) => m.lanes.length)),
    [matches],
  );
  const assignments = useMemo(
    () =>
      pending
        ? new Map<string, Assignment>()
        : buildAssignments(matches, reveal.settledCount),
    [pending, matches, reveal.settledCount],
  );

  /**
   * Mengundi (Start drawing) atau mengundi ulang (Shuffle again): hasil langsung dihitung,
   * error Lock sebelumnya dihapus, lalu animasi reveal diputar. Animasi hanya tampilan;
   * draf sudah final saat tombol ditekan.
   */
  function shuffleAgain() {
    lock.reset();
    setDraft(queue ? buildQueue(entryIds) : buildDrawing(entryIds, lanes));
    reveal.start();
  }

  /** Mengirim draf ke API. Pindah ke Matches hanya bila berhasil; gagal tampil inline dan bisa diulang. */
  async function lockDrawing() {
    if (!draft) return;
    try {
      await lock.mutateAsync(draft);
    } catch {
      return; // pesan error dibaca dari `lock.error` di bawah
    }
    router.push(ROUTES.liveMatches(competitionId));
  }

  // Alasan dari API didahulukan, lalu offline, lalu "belum diundi".
  const blockedReason = !drawing.actions.lock
    ? drawing.lockBlockedReason
      ? DRAWING_BLOCKED_LABEL[drawing.lockBlockedReason]
      : "You do not have permission to lock this drawing."
    : !online
      ? "You are offline. Reconnect to lock the drawing."
      : pending && participants.length > 0
        ? "Start the drawing first"
        : null;
  const empty = participants.length === 0;

  return (
    <DrawingLayout
      stats={
        queue
          ? [
              { value: participants.length, label: "checked in" },
              { value: participants.length, label: "in the queue" },
            ]
          : [
              { value: participants.length, label: "checked in" },
              { value: lanes, label: "lanes" },
              { value: matches.length, label: "matches" },
            ]
      }
      intro={
        queue ? (
          <p>
            Only approved, paid and checked-in participants are drawn. Press
            Start drawing to draw the running order. Shuffle as often as you
            like until you lock: nothing is saved before that. After locking,
            you can still swap two participants until the first attempt starts.
          </p>
        ) : (
          <p>
            Only approved, paid and checked-in participants are drawn. Press
            Start drawing to draw. Shuffle as often as you like until you lock:
            nothing is saved before that. After locking, you can still swap two
            participants until their match starts.
          </p>
        )
      }
      panel={
        <DrawingParticipantsPanel
          participants={participants}
          assignments={assignments}
          activeId={activeId}
          onActive={setActiveId}
          queue={queue}
        />
      }
      actions={
        <>
          {lock.isError && (
            <p
              role="alert"
              className="text-danger-ink text-sm font-semibold xl:basis-full xl:text-right"
            >
              {mutationMessage(
                lock.error,
                queue
                  ? "Unable to lock the running order."
                  : "Unable to lock the drawing.",
              )}{" "}
              Press Lock again to retry.
            </p>
          )}
          {blockedReason && (
            <p
              id="lock-blocked"
              className="text-danger-ink text-sm font-semibold xl:basis-full xl:text-right"
            >
              {blockedReason}
            </p>
          )}
          <p aria-live="polite" className="sr-only">
            {!reveal.revealing && reveal.completions > 0
              ? queue
                ? `Running order drawn, ${participants.length} ${participants.length === 1 ? "participant" : "participants"}`
                : `Drawing complete, ${matches.length} ${matches.length === 1 ? "match" : "matches"}`
              : ""}
          </p>
          {reveal.revealing && (
            <Button
              variant="secondary"
              className="min-h-12 w-full rounded-xl xl:w-auto xl:px-5"
              onClick={reveal.skip}
            >
              Skip animation
            </Button>
          )}
          <Button
            variant={pending ? "primary" : "secondary"}
            className="min-h-12 w-full rounded-xl xl:w-auto xl:px-5"
            disabled={empty || lock.isPending || reveal.revealing}
            onClick={shuffleAgain}
          >
            <Shuffle size={16} aria-hidden />
            {pending ? "Start drawing" : "Shuffle again"}
          </Button>
          <Button
            className="min-h-12 w-full rounded-xl text-base xl:w-auto xl:px-5"
            disabled={
              empty ||
              pending ||
              !drawing.actions.lock ||
              !online ||
              lock.isPending ||
              reveal.revealing
            }
            aria-describedby={blockedReason ? "lock-blocked" : undefined}
            onClick={() => void lockDrawing()}
          >
            <Lock size={16} aria-hidden />
            {lock.isPending
              ? "Locking..."
              : queue
                ? "Lock running order & go to run"
                : "Lock drawing & go to matches"}
          </Button>
        </>
      }
    >
      {empty && (
        <LiveNotice message="No participant is checked in and paid yet. Participants appear here once they check in." />
      )}
      {!empty && (
        <MatchGrid busy={reveal.revealing}>
          {matches.map((match, index) => (
            <DrawingMatchCard
              key={match.id}
              match={match}
              swappable={false}
              selectedIds={[]}
              busy={false}
              onPick={() => undefined}
              pending={pending}
              variant={queue ? "queue" : "match"}
              reveal={{
                firstSlot: offsets[index],
                settledCount: reveal.settledCount,
                frame: reveal.frame,
                pool: participants,
                animate: reveal.started,
              }}
              activeId={activeId}
              onActive={setActiveId}
              previewSelected={match.number === previewNumber}
              onPreview={setPreviewNumber}
            />
          ))}
        </MatchGrid>
      )}
      {!queue && matches.length > 0 && (
        <DrawingArenaPreview
          matches={matches}
          selectedNumber={previewNumber}
          onSelect={setPreviewNumber}
          laneCount={drawing.lanes}
          revealing={reveal.revealing}
          pending={pending}
        />
      )}
    </DrawingLayout>
  );
}

/**
 * Mencari posisi satu peserta untuk kalimat konfirmasi swap: "Pet (Match 1, lane 2)" pada Race,
 * "Pet (Position 2)" pada antrean Time trial.
 */
function describeEntry(
  matches: readonly DrawingMatch[],
  entryId: string,
  queue = false,
) {
  for (const match of matches) {
    const lane = match.lanes.find((l) => l.entryId === entryId);
    if (lane)
      return queue
        ? `${lane.petName} (Position ${lane.laneNumber})`
        : `${lane.petName} (Match ${match.number}, lane ${lane.laneNumber})`;
  }
  return null;
}

/** Tanggal+jam kunci untuk badge, contoh "11 Oct 2026, 14:00". */
function formatLockedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Drawing yang sudah di-lock: hanya baca, dengan badge "Locked". Bila API mengizinkan swap
 * (`actions.swap`), pengguna memilih satu peserta lalu peserta lain, dan panel di kolom kiri
 * meminta konfirmasi sebelum `useSwapDrawing` dikirim (dua langkah supaya tidak salah tukar).
 * Dipanggil dari LiveDrawing saat status LOCKED. `queue` = Time trial (satu kartu "Running order").
 */
function LockedDrawing({
  competitionId,
  drawing,
  queue,
}: {
  competitionId: string;
  drawing: CompetitionDrawing;
  queue: boolean;
}) {
  const online = useOnlineStatus();
  const swap = useSwapDrawing(competitionId);
  const [picked, setPicked] = useState<string[]>([]);
  // Dua peserta yang baru ditukar, disorot ~1,2 detik sebagai konfirmasi.
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewNumber, setPreviewNumber] = useState(1);
  const { matches } = drawing;
  const assignments = useMemo(
    () => buildAssignments(matches, Infinity),
    [matches],
  );

  // Sorotan dilepas otomatis; timer dibersihkan bila swap berikutnya atau unmount.
  useEffect(() => {
    if (flashIds.length === 0) return;
    const timer = setTimeout(() => setFlashIds([]), 1200);
    return () => clearTimeout(timer);
  }, [flashIds]);
  // Pilihan yang sudah tidak ada di drawing (mis. setelah refresh) dibuang.
  const selected = picked.filter(
    (id) => describeEntry(matches, id, queue) !== null,
  );
  const canSwap = drawing.actions.swap;

  /** Memilih/membatalkan pilihan satu peserta; maksimal dua, pilihan ketiga menggantikan yang kedua. */
  function pick(entryId: string) {
    swap.reset();
    setPicked((current) => {
      if (current.includes(entryId))
        return current.filter((id) => id !== entryId);
      if (current.length < 2) return [...current, entryId];
      return [current[0], entryId];
    });
  }

  /** Mengirim swap. Sukses: pilihan dihapus. Gagal: pilihan dipertahankan agar bisa diulang. */
  async function confirmSwap() {
    try {
      await swap.mutateAsync({ entryIdA: selected[0], entryIdB: selected[1] });
    } catch {
      return; // pesan error dibaca dari `swap.error` di bawah
    }
    setFlashIds(selected);
    setPicked([]);
    toast.success("Participants swapped");
  }

  const first = selected[0] ? describeEntry(matches, selected[0], queue) : null;
  const second = selected[1]
    ? describeEntry(matches, selected[1], queue)
    : null;
  const lockedAt = formatLockedAt(drawing.lockedAt);

  return (
    <DrawingLayout
      stats={
        queue
          ? [
              { value: drawing.participants.length, label: "checked in" },
              { value: matches[0]?.lanes.length ?? 0, label: "in the queue" },
            ]
          : [
              { value: drawing.participants.length, label: "checked in" },
              { value: drawing.lanes, label: "lanes" },
              { value: matches.length, label: "matches" },
            ]
      }
      intro={
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="bg-success-soft text-done inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold motion-safe:animate-[draw-fade_400ms_ease-out]">
              <Lock size={14} aria-hidden /> Locked
            </span>
            {drawing.lockedByName && (
              <span className="text-sm">
                by {drawing.lockedByName}
                {lockedAt && ` on ${lockedAt}`}
              </span>
            )}
          </p>
          <p>
            {queue
              ? canSwap
                ? "The running order is locked. To swap two participants, select one and then the other. The order cannot be changed once the first attempt has started."
                : "The running order is locked. Swapping is not available right now."
              : canSwap
                ? "The drawing is locked. To swap two participants, select one and then the other. Matches that have started cannot be changed."
                : "The drawing is locked. Swapping is not available right now."}
          </p>
        </>
      }
      panel={
        <DrawingParticipantsPanel
          participants={drawing.participants}
          assignments={assignments}
          activeId={activeId}
          onActive={setActiveId}
          queue={queue}
        />
      }
      actions={
        <>
          {canSwap && (
            <div
              aria-live="polite"
              className="border-border bg-muted grid gap-2 rounded-xl border p-3 text-sm xl:w-96"
            >
              {!first && <p>Select a participant to swap.</p>}
              {first && !second && (
                <p>
                  <b>{first}</b> selected. Pick the participant to swap with.
                </p>
              )}
              {first && second && (
                <p>
                  Swap <b>{first}</b> with <b>{second}</b>?
                </p>
              )}
              {swap.isError && (
                <p role="alert" className="text-danger-ink font-semibold">
                  {mutationMessage(swap.error, "Unable to swap.")} You can try
                  again.
                </p>
              )}
              {!online && (
                <p className="text-danger-ink font-semibold">
                  You are offline. Reconnect to swap.
                </p>
              )}
              {selected.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    disabled={swap.isPending}
                    onClick={() => {
                      swap.reset();
                      setPicked([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="min-h-11"
                    disabled={selected.length < 2 || !online || swap.isPending}
                    onClick={() => void confirmSwap()}
                  >
                    {swap.isPending ? "Swapping..." : "Confirm swap"}
                  </Button>
                </div>
              )}
            </div>
          )}
          <Link
            href={ROUTES.liveMatches(competitionId)}
            className={cn(
              buttonVariants(),
              "min-h-12 w-full rounded-xl text-base xl:w-auto xl:px-5",
            )}
          >
            {queue ? "Go to run" : "Go to matches"}
          </Link>
        </>
      }
    >
      <MatchGrid>
        {matches.map((match) => (
          <DrawingMatchCard
            key={match.id}
            match={match}
            swappable={canSwap}
            selectedIds={selected}
            busy={swap.isPending}
            onPick={pick}
            flashIds={flashIds}
            activeId={activeId}
            onActive={setActiveId}
            previewSelected={match.number === previewNumber}
            onPreview={setPreviewNumber}
            variant={queue ? "queue" : "match"}
          />
        ))}
      </MatchGrid>
      {!queue && matches.length > 0 && (
        <DrawingArenaPreview
          matches={matches}
          selectedNumber={previewNumber}
          onSelect={setPreviewNumber}
          laneCount={drawing.lanes}
          revealing={false}
        />
      )}
    </DrawingLayout>
  );
}

/** Kerangka saat data dimuat: kolom statistik dan beberapa kartu match. */
function Loading() {
  return (
    <div className="grid gap-4 p-4 md:p-7" aria-busy>
      <Skeleton className="h-24 w-full max-w-sm" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Layar Drawing Live Mode (langkah 1). Dipanggil dari `drawing/page.tsx`.
 * Memuat kompetisi + jenisnya; selain Race dan Time trial hanya menampilkan penjelasan. Untuk
 * keduanya memuat drawing dan memilih tampilan: draf (NOT_DRAWN) atau terkunci (LOCKED). Time trial
 * (`isQueueType`) memakai tampilan yang sama dalam varian antrean "Running order". 403 pada drawing
 * menampilkan halaman "No access"; error lain kartu error dengan "Try again".
 */
export function LiveDrawing({ competitionId }: { competitionId: string }) {
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const type = types.data?.find((t) => t.id === competition.data?.typeId);
  const drawable = isDrawableType(type?.code);
  const queue = isQueueType(type?.code);
  const drawing = useDrawing(competitionId, drawable);

  if (competition.isError || types.isError)
    return (
      <div className="p-4 md:p-7">
        <ErrorState
          error={competition.error ?? types.error}
          fallback="Unable to load this competition."
          onRetry={() => {
            void competition.refetch();
            void types.refetch();
          }}
        />
      </div>
    );
  if (!competition.data || !type) return <Loading />;
  if (!drawable)
    return (
      <div className="p-4 md:p-7">
        <LiveNotice
          message={`${DRAWING_UNSUPPORTED_MESSAGE}. This competition uses another format.`}
        >
          {isJudgingTypeCode(type.code) && (
            <Link
              href={ROUTES.liveJudging(competitionId)}
              className={cn(buttonVariants(), "min-h-11")}
            >
              Go to Judging
            </Link>
          )}
        </LiveNotice>
      </div>
    );

  if (drawing.isError) {
    if (drawing.error instanceof ApiError && drawing.error.status === 403)
      return <Forbidden />;
    return (
      <div className="p-4 md:p-7">
        <ErrorState
          error={drawing.error}
          fallback="Unable to load the drawing."
          onRetry={() => void drawing.refetch()}
        />
      </div>
    );
  }
  if (!drawing.data) return <Loading />;

  const data = drawing.data;
  // key = jumlah lane + daftar peserta: bila salah satunya berubah, draf diundi ulang dari data baru.
  const draftKey = `${data.lanes}:${data.participants.map((p) => p.entryId).join(",")}`;
  return (
    <div className="grid">
      {DRAWING_API_IS_MOCK && (
        <div className="px-4 pt-4 md:px-7 md:pt-7">
          <MockBanner />
        </div>
      )}
      {data.locked ? (
        <LockedDrawing
          competitionId={competitionId}
          drawing={data}
          queue={queue}
        />
      ) : (
        <DraftDrawing
          key={draftKey}
          competitionId={competitionId}
          drawing={data}
          queue={queue}
        />
      )}
    </div>
  );
}
