import { PetWorkspace } from "@/app/(portal)/pet-management/_components/pet-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  return <PetWorkspace mode="edit" id={petId} />;
}
