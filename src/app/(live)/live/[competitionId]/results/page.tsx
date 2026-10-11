import { LiveResults } from "../_components/live-results";

export default async function LiveResultsPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <LiveResults competitionId={competitionId} />;
}
