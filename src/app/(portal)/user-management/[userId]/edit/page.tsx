import { UserEditPage } from "../../_components/user-form";

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <UserEditPage userId={userId} />;
}
