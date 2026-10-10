import { EventParticipants } from "../../participants/_components/event-participants";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventParticipants eventId={eventId} />;
}
