import { EventCompetitions } from "../../competitions/_components/event-competitions";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventCompetitions eventId={eventId} />;
}
