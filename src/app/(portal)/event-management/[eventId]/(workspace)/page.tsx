import { EventOverview } from "../_components/event-overview";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventOverview eventId={eventId} />;
}
