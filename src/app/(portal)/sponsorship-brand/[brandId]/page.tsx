import { BrandDetailPage } from "../_components/brand-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <BrandDetailPage brandId={brandId} />;
}
