import { BrandEditPage } from "../../_components/brand-form";

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <BrandEditPage brandId={brandId} />;
}
