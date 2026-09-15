import { UserForm } from "@/app/(portal)/user-management/_components/user-form";
export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <UserForm mode="edit" id={userId} />;
}
