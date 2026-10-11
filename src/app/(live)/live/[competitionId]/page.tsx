import { LiveEntry } from "./_components/live-entry";

/** /live/[competitionId] membuka langkah pertama menurut tipe: Judging (Contest) atau Drawing. */
export default async function LiveIndexPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <LiveEntry competitionId={competitionId} />;
}
