import { CompetitionView } from "@/app/(portal)/competition/_components/competition-view";
export default async function Page({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return <CompetitionView id={competitionId} view="run-match" />;
}
