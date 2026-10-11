"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompetition } from "@/domains/competitions/queries";
import { useEvent } from "@/domains/events/queries";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";
import { ConnectionBadge } from "./live-connection";
import { LiveSponsorStrip } from "./live-sponsor-strip";

/** Tiga langkah Live Mode, urut. Matches dan Results masih halaman placeholder. */
export function liveTabs(competitionId: string) {
  return [
    { label: "Drawing", number: 1, href: ROUTES.liveDrawing(competitionId) },
    { label: "Matches", number: 2, href: ROUTES.liveMatches(competitionId) },
    { label: "Results", number: 3, href: ROUTES.liveResults(competitionId) },
  ];
}

/** Subjudul header di bawah nama kompetisi: "Drawing - Round 1" di langkah Drawing, selain itu nama event. */
function Subtitle({
  eventId,
  onDrawing,
}: {
  eventId: string;
  onDrawing: boolean;
}) {
  const event = useEvent(eventId);
  if (onDrawing) return <>Drawing - Round 1</>;
  return <>{event.data?.name ?? ""}</>;
}

/**
 * Isi layar saat kompetisi gagal dimuat: 403 -> halaman "No access", 404 -> pesan tidak
 * ditemukan tanpa tombol ulang, selain itu kartu error dengan "Try again".
 */
function LoadFailure({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.status === 403) return <Forbidden />;
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="mx-auto mt-10 grid w-full max-w-lg gap-4 px-4">
      <ErrorState
        error={error}
        fallback={
          notFound
            ? "This competition was not found."
            : "Unable to load this competition."
        }
        onRetry={notFound ? undefined : onRetry}
      />
      <Link
        href={ROUTES.home}
        className="text-primary text-center font-semibold"
      >
        Back to home
      </Link>
    </div>
  );
}

/**
 * Kerangka layar penuh Live Mode (tanpa sidebar portal). Dipanggil dari layout
 * `(live)/live/[competitionId]`. Berisi: tombol kembali ke workspace kompetisi, judul + subjudul,
 * tiga tab langkah (rute asli), badge koneksi (D5), isi halaman, dan strip sponsor.
 * Status muat, error, 403, dan 404 kompetisi ditangani di sini sehingga halaman anak
 * hanya dirender saat kompetisi sudah ada.
 */
export function LiveShell({
  competitionId,
  children,
}: {
  competitionId: string;
  children: ReactNode;
}) {
  const competition = useCompetition(competitionId);
  const pathname = usePathname();
  const tabs = liveTabs(competitionId);
  const c = competition.data;
  const onDrawing = pathname.startsWith(ROUTES.liveDrawing(competitionId));
  const backHref = c
    ? ROUTES.eventManagement.competitionDetail(c.eventId, c.id)
    : ROUTES.home;

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="Exit Live Mode"
            className="border-border bg-card text-foreground hover:bg-muted grid size-11 shrink-0 place-items-center rounded-xl border"
          >
            <ChevronLeft size={18} aria-hidden />
          </Link>
          <div className="grid min-w-0">
            {c ? (
              <h1 className="font-display text-xl leading-6 font-bold wrap-break-word">
                {c.name}
              </h1>
            ) : (
              <Skeleton className="h-6 w-44" />
            )}
            {c ? (
              <p className="text-muted-foreground min-h-5 text-[13px]">
                <Subtitle eventId={c.eventId} onDrawing={onDrawing} />
              </p>
            ) : (
              <Skeleton className="mt-1 h-4 w-32" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ConnectionBadge />
          <nav
            aria-label="Live steps"
            className="flex gap-1.5 text-[13px] font-bold"
          >
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "grid min-h-11 place-items-center rounded-full border px-3.5 whitespace-nowrap",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-primary-dark hover:bg-muted",
                  )}
                >
                  {tab.number} {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="min-w-0 flex-1">
        {competition.isError ? (
          <LoadFailure
            error={competition.error}
            onRetry={() => void competition.refetch()}
          />
        ) : c ? (
          children
        ) : (
          <div className="grid gap-4 p-4 md:p-7" aria-busy>
            <Skeleton className="h-24 w-full max-w-sm" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
      </main>

      {c && <LiveSponsorStrip eventId={c.eventId} />}
    </div>
  );
}
