import { EventEditPage } from "../../_components/event-edit-form";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventEditPage eventId={eventId} />;
}
