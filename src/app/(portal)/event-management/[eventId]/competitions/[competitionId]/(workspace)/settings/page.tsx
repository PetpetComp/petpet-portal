import { CompetitionSettings } from "../../_components/competition-settings";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <CompetitionSettings eventId={eventId} competitionId={competitionId} />
  );
}
