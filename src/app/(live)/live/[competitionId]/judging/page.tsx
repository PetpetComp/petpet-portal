import { LiveJudging } from "../_components/judging/live-judging";

export default async function LiveJudgingPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <LiveJudging competitionId={competitionId} />;
}
