import { CompetitionCreatePage } from "../_components/competition-create-page";

export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <CompetitionCreatePage eventId={eventId} />;
}
