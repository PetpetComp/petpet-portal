import { InvitationsTab } from "../../_components/invitations-tab";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <InvitationsTab organizationId={organizationId} />;
}
