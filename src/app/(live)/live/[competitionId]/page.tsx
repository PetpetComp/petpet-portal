import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants/routes";

/** /live/[competitionId] langsung membuka langkah pertama: Drawing. */
export default async function LiveIndexPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  redirect(ROUTES.liveDrawing(competitionId));
}
