import { LiveShell } from "./_components/live-shell";

/** Kerangka Live Mode satu kompetisi: header, tab langkah, badge koneksi, strip sponsor. */
export default async function LiveCompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <LiveShell competitionId={competitionId}>{children}</LiveShell>;
}
