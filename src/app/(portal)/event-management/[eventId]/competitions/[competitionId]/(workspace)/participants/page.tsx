import { EventParticipants } from "@/app/(portal)/event-management/[eventId]/participants/_components/event-participants";

/** Tab Participants kompetisi: meja check-in yang sama dengan tab event, terkunci ke kompetisi ini. */
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  return (
    <EventParticipants eventId={eventId} lockedCompetitionId={competitionId} />
  );
}
