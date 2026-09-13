import { BrandWorkspace } from "@/app/(portal)/sponsorship-brand/_components/brand-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <BrandWorkspace mode="edit" id={brandId} />;
}
