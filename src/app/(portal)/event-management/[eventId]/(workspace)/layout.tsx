import { EventShell } from "../_components/event-shell";

/** Header + tabs shared by every event tab. Competition detail pages sit outside this group. */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventShell eventId={eventId}>{children}</EventShell>;
}
