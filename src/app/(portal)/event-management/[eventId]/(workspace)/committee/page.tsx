import { EventCommittee } from "../../committee/_components/event-committee";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventCommittee eventId={eventId} />;
}
