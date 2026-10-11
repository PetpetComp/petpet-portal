"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Users } from "lucide-react";
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
} from "@/domains/drawing/constants";
import { buildDrawing, draftMatches } from "@/domains/drawing/draw";
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
import { DrawingMatchCard } from "./drawing-match-card";
import { useOnlineStatus } from "./live-connection";

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

/** Kartu angka kecil (checked in, lanes, matches). Angka memakai font display seperti desain. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-card grid content-start rounded-2xl p-3.5">
      <b className="font-display text-3xl leading-9">{value}</b>
      <span className="text-muted-foreground text-[13px]">{label}</span>
    </div>
  );
}

/** Pemberitahuan kosong/informasi dengan ikon, tanpa bergantung pada portal.css. */
function LiveNotice({ message }: { message: string }) {
  return (
    <div className="border-border bg-card grid justify-items-center gap-3 rounded-2xl border p-8 text-center">
      <Users size={28} className="text-primary-dark" aria-hidden />
      <p className="text-muted-foreground max-w-md">{message}</p>
    </div>
  );
}

/**
 * Kerangka dua kolom layar Drawing. Dipanggil dari DraftDrawing dan LockedDrawing.
 * Tablet ke atas: kolom kiri (statistik + teks, lalu tombol) dan kolom kanan (kartu match).
 * HP: statistik di atas, kartu match, lalu bar tombol yang menempel di dasar layar.
 * Urutan DOM: intro, tombol, kartu (tombol lebih dulu bagi pengguna keyboard); di HP
 * tombol dipindah ke akhir lewat `order`.
 */
function DrawingLayout({
  stats,
  intro,
  actions,
  children,
}: {
  stats: { checkedIn: number; lanes: number; matches: number };
  intro: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-6 md:gap-y-4 md:p-7">
      <div className="grid content-start gap-4 md:col-start-1 md:row-start-1">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={stats.checkedIn} label="checked in" />
          <Stat value={stats.lanes} label="lanes" />
          <Stat value={stats.matches} label="matches" />
        </div>
        <div className="text-muted-foreground grid gap-3 leading-[21px]">
          {intro}
        </div>
      </div>
      <div
        className={cn(
          "grid content-start gap-2.5 md:col-start-1 md:row-start-2",
          "max-md:border-border max-md:bg-card max-md:sticky max-md:bottom-0 max-md:z-10 max-md:order-last max-md:-mx-4 max-md:border-t max-md:p-3",
        )}
      >
        {actions}
      </div>
      <div className="grid min-w-0 gap-3 md:col-start-2 md:row-span-2 md:row-start-1">
        {children}
      </div>
    </div>
  );
}

/** Grid kartu match: sebanyak yang muat, tiap kartu minimal 240px (satu kolom di HP 375). */
function MatchGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] content-start gap-3">
      {children}
    </div>
  );
}

/** Pesan error dari mutation (Lock/Swap) untuk ditampilkan inline. */
function mutationMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Drawing yang belum di-lock: draf acak di sisi klien dari peserta yang berhak (keputusan 2A,
 * hanya Lock yang menyimpan). Dipanggil dari LiveDrawing saat status NOT_DRAWN.
 * Shuffle again mengundi ulang; Lock mengirim susunan entry id ke API lalu pindah ke tab Matches.
 * Tombol Lock mengikuti `actions.lock` dan `lock_blocked_reason` dari API, bukan aturan di sini.
 */
function DraftDrawing({
  competitionId,
  drawing,
}: {
  competitionId: string;
  drawing: CompetitionDrawing;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const lock = useLockDrawing(competitionId);
  const { participants, lanes } = drawing;
  const entryIds = participants.map((p) => p.entryId);
  const [draft, setDraft] = useState<string[][]>(() =>
    buildDrawing(entryIds, lanes),
  );
  const matches = useMemo(
    () => draftMatches(participants, draft),
    [participants, draft],
  );

  /** Mengundi ulang draf dan menghapus error Lock sebelumnya. */
  function shuffleAgain() {
    lock.reset();
    setDraft(buildDrawing(entryIds, lanes));
  }

  /** Mengirim draf ke API. Pindah ke Matches hanya bila berhasil; gagal tampil inline dan bisa diulang. */
  async function lockDrawing() {
    try {
      await lock.mutateAsync(draft);
    } catch {
      return; // pesan error dibaca dari `lock.error` di bawah
    }
    router.push(ROUTES.liveMatches(competitionId));
  }

  const blockedReason = !drawing.actions.lock
    ? drawing.lockBlockedReason
      ? DRAWING_BLOCKED_LABEL[drawing.lockBlockedReason]
      : "You do not have permission to lock this drawing."
    : !online
      ? "You are offline. Reconnect to lock the drawing."
      : null;
  const empty = participants.length === 0;

  return (
    <DrawingLayout
      stats={{
        checkedIn: participants.length,
        lanes,
        matches: matches.length,
      }}
      intro={
        <p>
          Only approved, paid and checked-in participants are drawn. Shuffle as
          often as you like: nothing is saved until you lock. After locking, you
          can still swap two participants until their match starts.
        </p>
      }
      actions={
        <>
          {lock.isError && (
            <p role="alert" className="text-danger-ink text-sm font-semibold">
              {mutationMessage(lock.error, "Unable to lock the drawing.")} Press
              Lock again to retry.
            </p>
          )}
          {blockedReason && (
            <p
              id="lock-blocked"
              className="text-danger-ink text-sm font-semibold"
            >
              {blockedReason}
            </p>
          )}
          <Button
            variant="secondary"
            className="min-h-12 w-full rounded-xl"
            disabled={empty || lock.isPending}
            onClick={shuffleAgain}
          >
            Shuffle again
          </Button>
          <Button
            className="min-h-12 w-full rounded-xl text-base"
            disabled={
              empty || !drawing.actions.lock || !online || lock.isPending
            }
            aria-describedby={blockedReason ? "lock-blocked" : undefined}
            onClick={() => void lockDrawing()}
          >
            <Lock size={16} aria-hidden />
            {lock.isPending ? "Locking..." : "Lock drawing & go to matches"}
          </Button>
        </>
      }
    >
      {empty ? (
        <LiveNotice message="No participant is checked in and paid yet. Participants appear here once they check in." />
      ) : (
        <MatchGrid>
          {matches.map((match) => (
            <DrawingMatchCard
              key={match.id}
              match={match}
              swappable={false}
              selectedIds={[]}
              busy={false}
              onPick={() => undefined}
            />
          ))}
        </MatchGrid>
      )}
    </DrawingLayout>
  );
}

/** Mencari posisi (nomor match dan lane) satu peserta untuk kalimat konfirmasi swap. */
function describeEntry(matches: readonly DrawingMatch[], entryId: string) {
  for (const match of matches) {
    const lane = match.lanes.find((l) => l.entryId === entryId);
    if (lane)
      return `${lane.petName} (Match ${match.number}, lane ${lane.laneNumber})`;
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
 * Dipanggil dari LiveDrawing saat status LOCKED.
 */
function LockedDrawing({
  competitionId,
  drawing,
}: {
  competitionId: string;
  drawing: CompetitionDrawing;
}) {
  const online = useOnlineStatus();
  const swap = useSwapDrawing(competitionId);
  const [picked, setPicked] = useState<string[]>([]);
  const { matches } = drawing;
  // Pilihan yang sudah tidak ada di drawing (mis. setelah refresh) dibuang.
  const selected = picked.filter((id) => describeEntry(matches, id) !== null);
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
    setPicked([]);
    toast.success("Participants swapped");
  }

  const first = selected[0] ? describeEntry(matches, selected[0]) : null;
  const second = selected[1] ? describeEntry(matches, selected[1]) : null;
  const lockedAt = formatLockedAt(drawing.lockedAt);

  return (
    <DrawingLayout
      stats={{
        checkedIn: drawing.participants.length,
        lanes: drawing.lanes,
        matches: matches.length,
      }}
      intro={
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="bg-success-soft text-done inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold">
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
            {canSwap
              ? "The drawing is locked. To swap two participants, select one and then the other. Matches that have started cannot be changed."
              : "The drawing is locked. Swapping is not available right now."}
          </p>
        </>
      }
      actions={
        <>
          {canSwap && (
            <div
              aria-live="polite"
              className="border-border bg-muted grid gap-2 rounded-xl border p-3 text-sm"
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
              "min-h-12 w-full rounded-xl text-base",
            )}
          >
            Go to matches
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
          />
        ))}
      </MatchGrid>
    </DrawingLayout>
  );
}

/** Kerangka saat data dimuat: kolom statistik dan beberapa kartu match. */
function Loading() {
  return (
    <div className="grid gap-4 p-4 md:p-7" aria-busy>
      <Skeleton className="h-24 w-full max-w-sm" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Layar Drawing Live Mode (langkah 1). Dipanggil dari `drawing/page.tsx`.
 * Memuat kompetisi + jenisnya; selain Race hanya menampilkan penjelasan. Untuk Race memuat
 * drawing dan memilih tampilan: draf (NOT_DRAWN) atau terkunci (LOCKED). 403 pada drawing
 * menampilkan halaman "No access"; error lain kartu error dengan "Try again".
 */
export function LiveDrawing({ competitionId }: { competitionId: string }) {
  const competition = useCompetition(competitionId);
  const types = useCompetitionTypes();
  const type = types.data?.find((t) => t.id === competition.data?.typeId);
  const isRace = type?.code === "RACE";
  const drawing = useDrawing(competitionId, isRace);

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
  if (!isRace)
    return (
      <div className="p-4 md:p-7">
        <LiveNotice
          message={`${DRAWING_UNSUPPORTED_MESSAGE}. This competition uses another format.`}
        />
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
  // key = daftar peserta: bila peserta yang berhak berubah, draf diundi ulang dari data baru.
  const draftKey = data.participants.map((p) => p.entryId).join(",");
  return (
    <div className="grid">
      {DRAWING_API_IS_MOCK && (
        <div className="px-4 pt-4 md:px-7 md:pt-7">
          <MockBanner />
        </div>
      )}
      {data.locked ? (
        <LockedDrawing competitionId={competitionId} drawing={data} />
      ) : (
        <DraftDrawing
          key={draftKey}
          competitionId={competitionId}
          drawing={data}
        />
      )}
    </div>
  );
}
