import { COMPETITION_SERVICES } from "@/services/competition";
import { collectRows } from "@/services/common";
import { fromApi, type ApiCompetition, type Competition } from "./types";

/** Events have a handful of competitions, so all of them are loaded at once. */
export async function listEventCompetitions(
  eventId: string,
): Promise<Competition[]> {
  const rows = await collectRows<ApiCompetition>(
    (p) => COMPETITION_SERVICES.list(eventId, p) as never,
  );
  return rows.map(fromApi);
}
