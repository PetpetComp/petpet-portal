import { afterEach, describe, expect, it } from "vitest";
import type {
  ApiCompetition,
  ApiCompetitionRule,
  ApiRegistrationPeriod,
  ApiScoreCriterion,
} from "@/domains/competitions/types";
import { resetCompetitionRuleStore } from "./mock-competitions";
import { mockRequest } from "./mock-request";
import { DEMO_PASSWORD, store } from "./mock-store";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk yang sama dengan petpet-service. */
const AGILITY = "comp-agility-sprint";
const FUN_RUN = "comp-puppy-fun-run";
const BEAUTY = "comp-beauty-class-open";
const OBEDIENCE = "comp-obedience-trial";

async function call<T>(
  method: string,
  url: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return (await mockRequest<{ data: T }>(method, url, body)).data;
}
const signIn = (email: string) =>
  call("POST", "/auth/login", { email, password: DEMO_PASSWORD });
const asOrganizer = () => signIn("organizer@petpet.dev");
const asCompetitor = () => signIn("competitor@petpet.dev");

// Tes di bawah mengubah kompetisi, channel, dan kriteria: kembalikan setelah tiap tes.
const seed = {
  competitions: structuredClone(store.competitions),
  periods: structuredClone(store.registrationPeriods),
  criteria: structuredClone(store.scoreCriteria),
};
afterEach(() => {
  store.competitions = structuredClone(seed.competitions);
  store.registrationPeriods = structuredClone(seed.periods);
  store.scoreCriteria = structuredClone(seed.criteria);
  resetCompetitionRuleStore();
});

describe("GET /competitions/{uuid}", () => {
  it("is readable without login and then allows nothing", async () => {
    const c = await call<ApiCompetition>("GET", `/competitions/${AGILITY}`);
    expect(c.uuid).toBe(AGILITY);
    expect(Object.values(c.actions).some(Boolean)).toBe(false);
  });
  it("answers 404 for an unknown competition", async () => {
    await expect(call("GET", "/competitions/nope")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("PATCH /competitions/{uuid}", () => {
  it("changes only the fields that were sent, and null clears a field", async () => {
    await asOrganizer();
    const c = await call<ApiCompetition>("PATCH", `/competitions/${AGILITY}`, {
      name: "Agility Sprint 2",
      arena_name: null,
    });
    expect(c).toMatchObject({
      name: "Agility Sprint 2",
      arena_name: null,
      capacity: 40,
    });
  });
  it("validates like UpdateRequest", async () => {
    await asOrganizer();
    await expect(
      call("PATCH", `/competitions/${AGILITY}`, { name: "" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("PATCH", `/competitions/${AGILITY}`, { capacity: 0 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("PATCH", `/competitions/${AGILITY}`, {
        scheduled_start_at: "2026-11-05T10:00:00+07:00",
        scheduled_end_at: "2026-11-05T09:00:00+07:00",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("needs login and the update permission", async () => {
    await asCompetitor();
    await expect(
      call("PATCH", `/competitions/${AGILITY}`, { name: "X" }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("competition rules", () => {
  it("lists every version, oldest first, with only the latest active", async () => {
    await asOrganizer();
    const rules = await call<ApiCompetitionRule[]>(
      "GET",
      `/competitions/${FUN_RUN}/rules`,
    );
    expect(rules.map((r) => [r.version, r.is_active])).toEqual([
      [1, false],
      [2, true],
    ]);
  });
  it("creates a new version, deactivates the old one and defaults what was not sent", async () => {
    await asOrganizer();
    const created = await call<ApiCompetitionRule>(
      "POST",
      `/competitions/${FUN_RUN}/rules`,
      { ranking_rule: ["POSITION_ASC"], lane_total: 6 },
    );
    expect(created).toMatchObject({
      version: 3,
      is_active: true,
      lane_total: 6,
      time_limit_ms: null,
      countdown_enabled: true,
      countdown_seconds: 3,
      attempt_limit: 1,
    });
    const rules = await call<ApiCompetitionRule[]>(
      "GET",
      `/competitions/${FUN_RUN}/rules`,
    );
    expect(rules.filter((r) => r.is_active).map((r) => r.version)).toEqual([3]);
  });
  it("requires a ranking rule and valid numbers", async () => {
    await asOrganizer();
    await expect(
      call("POST", `/competitions/${FUN_RUN}/rules`, { lane_total: 4 }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", `/competitions/${FUN_RUN}/rules`, {
        ranking_rule: ["TIME_ASC"],
        lane_total: 0,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("is forbidden for someone who does not manage the event", async () => {
    await asCompetitor();
    await expect(
      call("POST", `/competitions/${FUN_RUN}/rules`, {
        ranking_rule: ["TIME_ASC"],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("registration periods", () => {
  it("lists a plain array with decimal prices and the status", async () => {
    const periods = await call<ApiRegistrationPeriod[]>(
      "GET",
      `/competitions/${BEAUTY}/registration-periods`,
    );
    expect(periods).toEqual([
      {
        uuid: "per-beauty-online",
        competition_uuid: BEAUTY,
        period_type: "ONLINE",
        price: "75000.00",
        quota: null,
        registration_start_at: "2026-09-01T00:00:00+07:00",
        registration_end_at: "2026-10-09T23:59:00+07:00",
        status: "ACTIVE",
      },
    ]);
  });
  it("adds a channel but not a second one of the same type", async () => {
    await asOrganizer();
    const body = {
      period_type: "EARLY_BIRD",
      price: 60000,
      registration_start_at: "2026-08-01T00:00:00+07:00",
      registration_end_at: "2026-08-31T00:00:00+07:00",
    };
    const created = await call<ApiRegistrationPeriod>(
      "POST",
      `/competitions/${BEAUTY}/registration-periods`,
      body,
    );
    expect(created).toMatchObject({ price: "60000.00", status: "ACTIVE" });
    await expect(
      call("POST", `/competitions/${BEAUTY}/registration-periods`, body),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("rejects an end before the start and an unknown type", async () => {
    await asOrganizer();
    await expect(
      call("POST", `/competitions/${BEAUTY}/registration-periods`, {
        period_type: "ON_SITE",
        price: 1,
        registration_start_at: "2026-09-02T00:00:00+07:00",
        registration_end_at: "2026-09-01T00:00:00+07:00",
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", `/competitions/${BEAUTY}/registration-periods`, {
        period_type: "VIP",
        price: 1,
        registration_start_at: "2026-09-01T00:00:00+07:00",
        registration_end_at: "2026-09-02T00:00:00+07:00",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("patches the price, and wants both dates together", async () => {
    await asOrganizer();
    const updated = await call<ApiRegistrationPeriod>(
      "PATCH",
      "/registration-periods/per-beauty-online",
      { price: 80000, quota: 20 },
    );
    expect(updated).toMatchObject({ price: "80000.00", quota: 20 });
    // Seperti Laravel: tanggal selesai tanpa tanggal mulai di request yang sama ditolak.
    await expect(
      call("PATCH", "/registration-periods/per-beauty-online", {
        registration_end_at: "2026-10-30T00:00:00+07:00",
      }),
    ).rejects.toMatchObject({ status: 422 });
    const moved = await call<ApiRegistrationPeriod>(
      "PATCH",
      "/registration-periods/per-beauty-online",
      {
        registration_start_at: "2026-09-02T00:00:00+07:00",
        registration_end_at: "2026-10-30T00:00:00+07:00",
      },
    );
    expect(moved.registration_end_at).toBe("2026-10-30T00:00:00+07:00");
  });
  it("closes a channel with DELETE and keeps the row", async () => {
    await asOrganizer();
    const closed = await call<ApiRegistrationPeriod>(
      "DELETE",
      "/registration-periods/per-beauty-online",
    );
    expect(closed.status).toBe("CLOSED");
    const periods = await call<ApiRegistrationPeriod[]>(
      "GET",
      `/competitions/${BEAUTY}/registration-periods`,
    );
    expect(periods.map((p) => p.status)).toEqual(["CLOSED"]);
    await expect(
      call("DELETE", "/registration-periods/missing"),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("score criteria", () => {
  it("lists a judged competition's criteria in order, with decimal strings", async () => {
    const criteria = await call<ApiScoreCriterion[]>(
      "GET",
      `/competitions/${BEAUTY}/score-criteria`,
    );
    expect(criteria.map((c) => [c.name, c.weight])).toEqual([
      ["Appearance", "40.00"],
      ["Behavior", "30.00"],
      ["Presentation", "30.00"],
    ]);
    expect(criteria[0]).toMatchObject({
      min_score: "0.00",
      max_score: "10.00",
      status: "ACTIVE",
    });
  });
  it("adds a criterion and refuses a duplicate code", async () => {
    await asOrganizer();
    const body = {
      code: "TAIL",
      name: "Tail",
      weight: 10,
      min_score: 0,
      max_score: 5,
    };
    const created = await call<ApiScoreCriterion>(
      "POST",
      `/competitions/${BEAUTY}/score-criteria`,
      body,
    );
    expect(created).toMatchObject({ weight: "10.00", display_order: 4 });
    await expect(
      call("POST", `/competitions/${BEAUTY}/score-criteria`, body),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("POST /competitions/{uuid}/reopen-registration (mock only)", () => {
  const flags = async (uuid: string) =>
    (await call<ApiCompetition>("GET", `/competitions/${uuid}`)).actions;

  it("is offered only for a scheduled competition whose registration was closed", async () => {
    await asOrganizer();
    expect((await flags(OBEDIENCE)).reopen_registration).toBe(true);
    expect((await flags(AGILITY)).reopen_registration).toBe(false);
  });
  it("clears the closing time and then offers nothing more", async () => {
    await asOrganizer();
    const reopened = await call<ApiCompetition>(
      "POST",
      `/competitions/${OBEDIENCE}/reopen-registration`,
    );
    expect(reopened.registration_closed_at).toBeNull();
    expect(reopened.actions.reopen_registration).toBe(false);
    expect(reopened.actions.close_registration).toBe(true);
    await expect(
      call("POST", `/competitions/${OBEDIENCE}/reopen-registration`),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("is forbidden for someone who does not manage the event", async () => {
    await asCompetitor();
    await expect(
      call("POST", `/competitions/${OBEDIENCE}/reopen-registration`),
    ).rejects.toMatchObject({ status: 403 });
  });
});
