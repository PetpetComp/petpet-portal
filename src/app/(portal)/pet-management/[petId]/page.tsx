import { PetDetailPage } from "../_components/pet-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  return <PetDetailPage petId={petId} />;
}
