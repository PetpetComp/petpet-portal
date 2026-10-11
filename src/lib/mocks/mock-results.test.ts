import { afterEach, describe, expect, it } from "vitest";
import type { ApiCompetitionResults } from "@/domains/results/types";
import { rankResults, resetResultStore } from "./mock-results";
import { mockRequest } from "./mock-request";
import { DEMO_PASSWORD } from "./mock-store";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk sama dengan draf kontrak results. */
const FUN_RUN = "comp-puppy-fun-run"; // Race, COMPLETED, ada hasil
const PAW_RACE = "comp-cat-agility-relay"; // Race, CANCELLED, belum ada hasil
const BEAUTY = "comp-beauty-class-open"; // bukan Race

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

afterEach(() => resetResultStore());

describe("rankResults", () => {
  it("puts finishers by time first, then DNF, DQ and DNS", () => {
    const ranked = rankResults([
      { pet_uuid: "a", status: "DNS", finish_time_ms: null },
      { pet_uuid: "b", status: "FINISHED", finish_time_ms: 50000 },
      { pet_uuid: "c", status: "DQ", finish_time_ms: null },
      { pet_uuid: "d", status: "FINISHED", finish_time_ms: 40000 },
      { pet_uuid: "e", status: "DNF", finish_time_ms: null },
    ]);
    expect(ranked.map((r) => [r.pet_uuid, r.rank])).toEqual([
      ["d", 1],
      ["b", 2],
      ["e", 3],
      ["c", 4],
      ["a", 5],
    ]);
  });
});

describe("GET /competitions/{uuid}/results", () => {
  it("needs a login", async () => {
    await expect(
      call("GET", `/competitions/${FUN_RUN}/results`),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("answers 403 for an account unrelated to the event", async () => {
    await asCompetitor();
    await expect(
      call("GET", `/competitions/${FUN_RUN}/results`),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns the ranking in order with at least 6 rows including a DNF", async () => {
    await asOrganizer();
    const data = await call<ApiCompetitionResults>(
      "GET",
      `/competitions/${FUN_RUN}/results`,
    );
    expect(data.items.length).toBeGreaterThanOrEqual(6);
    expect(data.items.map((r) => r.rank)).toEqual(
      data.items.map((_, i) => i + 1),
    );
    expect(data.items[0]).toMatchObject({
      pet_name: "Rufus",
      status: "FINISHED",
      finish_time_ms: 38412,
    });
    const times = data.items
      .filter((r) => r.status === "FINISHED")
      .map((r) => r.finish_time_ms as number);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const dnf = data.items.find((r) => r.status === "DNF");
    expect(dnf).toMatchObject({ finish_time_ms: null });
    expect(dnf!.rank).toBeGreaterThan(times.length);
    expect(data.verification_status).toBe("PENDING");
    expect(data.actions.verify).toBe(true);
  });

  it("returns an empty ranking and no verify action when nothing is recorded", async () => {
    await asOrganizer();
    const data = await call<ApiCompetitionResults>(
      "GET",
      `/competitions/${PAW_RACE}/results`,
    );
    expect(data.items).toEqual([]);
    expect(data.actions.verify).toBe(false);
  });

  it("answers 422 for a competition that is not a Race", async () => {
    await asOrganizer();
    await expect(
      call("GET", `/competitions/${BEAUTY}/results`),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("POST /competitions/{uuid}/results/verify", () => {
  it("answers 403 for an account that may not manage the competition", async () => {
    await asCompetitor();
    await expect(
      call("POST", `/competitions/${FUN_RUN}/results/verify`, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("verifies once, records who and when, and then drops the action", async () => {
    await asOrganizer();
    const data = await call<ApiCompetitionResults>(
      "POST",
      `/competitions/${FUN_RUN}/results/verify`,
      {},
    );
    expect(data.verification_status).toBe("VERIFIED");
    expect(data.verified_at).not.toBeNull();
    expect(data.verified_by_name).toBe("Organizer Demo");
    expect(data.actions.verify).toBe(false);
    await expect(
      call("POST", `/competitions/${FUN_RUN}/results/verify`, {}),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("answers 422 when there are no results to verify", async () => {
    await asOrganizer();
    await expect(
      call("POST", `/competitions/${PAW_RACE}/results/verify`, {}),
    ).rejects.toMatchObject({ status: 422 });
  });
});
