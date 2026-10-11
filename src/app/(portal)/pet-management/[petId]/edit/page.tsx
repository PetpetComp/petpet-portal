import { PetEditPage } from "../../_components/pet-form-page";

export default async function Page({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  return <PetEditPage petId={petId} />;
}
