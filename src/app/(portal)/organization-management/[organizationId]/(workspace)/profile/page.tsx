import { ProfileTab } from "../../_components/profile-tab";

export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <ProfileTab organizationId={organizationId} />;
}
