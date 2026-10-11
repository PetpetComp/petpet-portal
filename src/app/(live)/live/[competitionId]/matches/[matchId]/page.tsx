import { RunMatch } from "../../_components/run/run-match";

/** Layar Run Match satu match: /live/[competitionId]/matches/[matchId]. */
export default async function LiveRunMatchPage({
  params,
}: {
  params: Promise<{ competitionId: string; matchId: string }>;
}) {
  const { competitionId, matchId } = await params;
  return <RunMatch competitionId={competitionId} matchId={matchId} />;
}
