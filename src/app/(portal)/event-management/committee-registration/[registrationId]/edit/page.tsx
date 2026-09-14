import { CommitteeWorkspace } from "@/app/(portal)/event-management/committee-registration/_components/committee-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;
  return <CommitteeWorkspace mode="edit" id={registrationId} />;
}
