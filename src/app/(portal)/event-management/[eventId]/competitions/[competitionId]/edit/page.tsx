import { CompetitionEditPage } from "../_components/competition-edit-page";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <CompetitionEditPage eventId={eventId} competitionId={competitionId} />
  );
}
