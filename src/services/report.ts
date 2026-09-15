import { collectRows, ok } from "./common";
import { USER_SERVICES } from "./user-management";
import { EVENT_SERVICES } from "./event-management";
import { PET_SERVICES } from "./pet-management";
export interface ReportSummary {
  totalEvents: number;
  totalUsers: number;
  totalPets: number;
}
export const REPORT_SERVICES = {
  async summary() {
    const [events, users, pets] = await Promise.all([
      collectRows(EVENT_SERVICES.list),
      collectRows(USER_SERVICES.list),
      collectRows(PET_SERVICES.list),
    ]);
    return ok<ReportSummary>({
      totalEvents: events.length,
      totalUsers: users.length,
      totalPets: pets.length,
    });
  },
};
