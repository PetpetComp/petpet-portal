import { PetForm } from "@/app/(portal)/pet-management/_components/pet-form";
export default async function Page({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  return <PetForm mode="edit" id={petId} />;
}
