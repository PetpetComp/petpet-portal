import { LiveDrawing } from "../_components/live-drawing";

export default async function LiveDrawingPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <LiveDrawing competitionId={competitionId} />;
}
