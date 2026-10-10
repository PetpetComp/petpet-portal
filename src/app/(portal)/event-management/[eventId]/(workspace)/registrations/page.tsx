import { EventRegistrations } from "../../registrations/_components/event-registrations";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventRegistrations eventId={eventId} />;
}
