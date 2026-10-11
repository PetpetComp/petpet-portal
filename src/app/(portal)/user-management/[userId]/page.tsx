import { UserDetailPage } from "../_components/user-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <UserDetailPage userId={userId} />;
}
