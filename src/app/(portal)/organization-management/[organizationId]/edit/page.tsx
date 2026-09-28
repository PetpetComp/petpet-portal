import { OrganizationWorkspace } from "../../_components/organization-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationWorkspace mode="edit" id={organizationId} />;
}
