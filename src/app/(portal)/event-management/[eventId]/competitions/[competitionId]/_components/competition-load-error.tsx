"use client";
import Link from "next/link";
import { Forbidden } from "@/components/common/can";
import { ErrorState } from "@/components/common/error-state";
import { ApiError } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants/routes";

/**
 * Keadaan "kompetisi tidak bisa ditampilkan" yang sama untuk header workspace dan halaman Edit:
 * 403 -> halaman "No access", 404 -> pesan tidak ditemukan, selain itu kartu error dengan Try again.
 * Dipanggil saat `useCompetition` gagal. Selalu menyediakan tautan kembali ke daftar kompetisi event.
 */
export function CompetitionLoadError({
  error,
  eventId,
  onRetry,
}: {
  error: unknown;
  eventId: string;
  onRetry: () => void;
}) {
  if (error instanceof ApiError && error.status === 403) return <Forbidden />;
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="grid gap-4">
      <ErrorState
        error={error}
        fallback={
          notFound
            ? "This competition was not found."
            : "Unable to load this competition."
        }
        onRetry={notFound ? undefined : onRetry}
      />
      <BackToCompetitions eventId={eventId} />
    </div>
  );
}

/** Kompetisi ada tetapi milik event lain: diperlakukan sama seperti tidak ditemukan. */
export function CompetitionNotFound({ eventId }: { eventId: string }) {
  return (
    <div className="grid gap-4">
      <ErrorState
        error={new Error("This competition was not found in this event.")}
      />
      <BackToCompetitions eventId={eventId} />
    </div>
  );
}

function BackToCompetitions({ eventId }: { eventId: string }) {
  return (
    <Link
      href={ROUTES.eventManagement.detail(eventId) + "/competitions"}
      className="text-primary font-semibold"
    >
      Back to competitions
    </Link>
  );
}
