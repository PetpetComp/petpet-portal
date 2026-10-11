import { CompetitionShell } from "../_components/competition-shell";

/** Header + tab yang dipakai semua tab kompetisi. Halaman Edit ada di luar grup ini, seperti Edit event. */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <CompetitionShell eventId={eventId} competitionId={competitionId}>
      {children}
    </CompetitionShell>
  );
}
