import { CompetitionOverview } from "../_components/competition-overview";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <CompetitionOverview eventId={eventId} competitionId={competitionId} />
  );
}
