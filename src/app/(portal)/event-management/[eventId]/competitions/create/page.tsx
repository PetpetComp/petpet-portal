import { CompetitionWorkspace } from "@/app/(portal)/event-management/[eventId]/competitions/_components/competition-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId?: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <CompetitionWorkspace eventId={eventId} id={competitionId} mode="create" />
  );
}
