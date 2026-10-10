import { EventSponsors } from "../../sponsors/_components/event-sponsors";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventSponsors eventId={eventId} />;
}
