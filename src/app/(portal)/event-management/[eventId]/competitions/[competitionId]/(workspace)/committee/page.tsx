import { EventCommittee } from "@/app/(portal)/event-management/[eventId]/committee/_components/event-committee";

/** Tab Committee kompetisi: tim event yang sama dengan tab event, dibatasi ke kompetisi ini. */
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <EventCommittee eventId={eventId} scopedCompetitionId={competitionId} />
  );
}
