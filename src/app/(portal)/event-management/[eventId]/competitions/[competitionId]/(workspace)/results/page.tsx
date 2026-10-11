import { CompetitionResults } from "../../_components/results/competition-results";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <CompetitionResults competitionId={competitionId} />;
}
