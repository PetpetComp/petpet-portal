import { MembersTab } from "../_components/members-tab";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <MembersTab organizationId={organizationId} />;
}
