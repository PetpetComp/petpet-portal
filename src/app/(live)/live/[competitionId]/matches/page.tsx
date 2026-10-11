import { LiveMatches } from "../_components/live-matches";

export default async function LiveMatchesPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <LiveMatches competitionId={competitionId} />;
}
