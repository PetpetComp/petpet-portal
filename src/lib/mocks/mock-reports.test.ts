import { describe, expect, it } from "vitest";
import type {
  ApiEventReport,
  ApiReportsOverview,
} from "@/domains/reports/types";
import { mockRequest } from "./mock-request";
import { DEMO_PASSWORD, store } from "./mock-store";

const JAKARTA = "evt-jakarta-pet-festival";

async function call<T>(method: string, url: string): Promise<T> {
  return (await mockRequest<{ data: T }>(method, url)).data;
}
const signIn = (email: string) =>
  mockRequest("POST", "/auth/login", { email, password: DEMO_PASSWORD });

describe("GET /events/{uuid}/report", () => {
  it("needs a login", async () => {
    await expect(
      call("GET", `/events/${JAKARTA}/report`),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("answers 403 for an account that does not manage the event", async () => {
    await signIn("competitor@petpet.dev");
    await expect(
      call("GET", `/events/${JAKARTA}/report`),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("answers 404 for an unknown event", async () => {
    await signIn("organizer@petpet.dev");
    await expect(call("GET", "/events/nope/report")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("counts only registered entries and sums the fees of paid ones", async () => {
    await signIn("organizer@petpet.dev");
    const data = await call<ApiEventReport>("GET", `/events/${JAKARTA}/report`);
    const competitionIds = new Set(
      store.competitions
        .filter((c) => c.event_uuid === JAKARTA)
        .map((c) => c.uuid),
    );
    const registered = store.entries.filter(
      (e) =>
        competitionIds.has(e.competition_uuid) && e.status === "REGISTERED",
    );
    const paid = registered.filter((e) => e.payment_status === "PAID");
    expect(data.totals.entries).toBe(registered.length);
    expect(data.totals.paid_entries).toBe(paid.length);
    expect(data.totals.unpaid_entries).toBe(registered.length - paid.length);
    expect(data.totals.revenue).toBe(
      paid.reduce((sum, e) => sum + e.registration_fee, 0),
    );
    // Total event = jumlah semua kompetisi.
    expect(data.competitions.reduce((n, c) => n + c.entries, 0)).toBe(
      data.totals.entries,
    );
    expect(data.participants).toHaveLength(data.totals.entries);
  });
});

describe("GET /reports/overview", () => {
  it("lists the managed events with totals that add up", async () => {
    await signIn("admin@petpet.dev");
    const data = await call<ApiReportsOverview>("GET", "/reports/overview");
    expect(data.totals.events).toBe(data.events.length);
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.totals.entries).toBe(
      data.events.reduce((sum, e) => sum + e.entries, 0),
    );
    expect(data.totals.revenue).toBe(
      data.events.reduce((sum, e) => sum + e.revenue, 0),
    );
  });

  it("answers 403 for an account without event access", async () => {
    await signIn("competitor@petpet.dev");
    await expect(call("GET", "/reports/overview")).rejects.toMatchObject({
      status: 403,
    });
  });
});
