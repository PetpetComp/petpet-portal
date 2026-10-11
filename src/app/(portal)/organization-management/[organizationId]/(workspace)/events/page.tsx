import { EventsTab } from "../../_components/events-tab";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <EventsTab organizationId={organizationId} />;
}
