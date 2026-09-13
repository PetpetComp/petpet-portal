import { EventWorkspace } from "@/app/(portal)/event-management/_components/event-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventWorkspace mode="detail" id={eventId} />;
}
