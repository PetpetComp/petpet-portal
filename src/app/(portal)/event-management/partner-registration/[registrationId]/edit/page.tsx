import { RegistrationWorkspace } from "@/app/(portal)/event-management/_components/registration-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;
  return (
    <RegistrationWorkspace kind="partners" mode="edit" id={registrationId} />
  );
}
