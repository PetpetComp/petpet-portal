import { EventReport } from "../../reports/_components/event-report";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventReport eventId={eventId} />;
}
