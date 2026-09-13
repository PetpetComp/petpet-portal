import { UserWorkspace } from "@/app/(portal)/user-management/_components/user-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <UserWorkspace mode="edit" id={userId} />;
}
