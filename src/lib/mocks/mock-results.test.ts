import { afterEach, describe, expect, it } from "vitest";
import type { ApiCompetitionResults } from "@/domains/results/types";
import { resetJudgingStore } from "./mock-judging";
import { rankResults, resetResultStore } from "./mock-results";
import { resetTimetrialStore } from "./mock-timetrial";
import { mockRequest } from "./mock-request";
import { DEMO_PASSWORD } from "./mock-store";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk sama dengan draf kontrak results. */
const FUN_RUN = "comp-puppy-fun-run"; // Race, COMPLETED, ada hasil
const PAW_RACE = "comp-cat-agility-relay"; // Race, CANCELLED, belum ada hasil
const BEAUTY = "comp-beauty-class-open"; // Contest, 2 juri LOCKED + 1 DRAFT
const SPEED_TRIAL = "comp-glider-speed-trial"; // Time trial, 2 peserta sudah punya attempt
const CHECKPOINT = "comp-agility-sprint"; // Checkpoint: belum punya klasemen

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

afterEach(() => {
  resetResultStore();
  resetJudgingStore();
  resetTimetrialStore();
});

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

  it("answers 422 for a type without a ranking (Checkpoint)", async () => {
    await asOrganizer();
    await expect(
      call("GET", `/competitions/${CHECKPOINT}/results`),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("Time trial results", () => {
  it("ranks the best valid time and counts the attempts", async () => {
    await asOrganizer();
    const data = await call<ApiCompetitionResults>(
      "GET",
      `/competitions/${SPEED_TRIAL}/results`,
    );
    expect(data.variant).toBe("TIME_TRIAL");
    // Peserta pertama: 41230 dan 38412 ms -> terbaik 38412 (2 attempt).
    // Peserta kedua: satu false start (tidak dihitung) dan 44870 ms (1 attempt).
    expect(data.items.map((r) => [r.rank, r.finish_time_ms])).toEqual([
      [1, 38412],
      [2, 44870],
    ]);
    expect(data.items.map((r) => r.attempts_used)).toEqual([2, 1]);
    expect(data.items.every((r) => r.score === null)).toBe(true);
  });

  it("can be verified once and then drops the action", async () => {
    await asOrganizer();
    const before = await call<ApiCompetitionResults>(
      "GET",
      `/competitions/${SPEED_TRIAL}/results`,
    );
    expect(before.actions.verify).toBe(true);
    const after = await call<ApiCompetitionResults>(
      "POST",
      `/competitions/${SPEED_TRIAL}/results/verify`,
      {},
    );
    expect(after.verification_status).toBe("VERIFIED");
    expect(after.actions.verify).toBe(false);
  });
});

describe("Contest results", () => {
  it("averages the locked judges and lists unscored entries last", async () => {
    await asOrganizer();
    const data = await call<ApiCompetitionResults>(
      "GET",
      `/competitions/${BEAUTY}/results`,
    );
    expect(data.variant).toBe("CONTEST");
    expect(data.items).toHaveLength(7);
    const scored = data.items.filter((r) => r.status === "FINISHED");
    // Dua peserta dinilai dua juri; yang ketiga baru DRAFT, jadi "Not scored".
    expect(scored).toHaveLength(2);
    expect(scored.every((r) => r.judges_scored === 2)).toBe(true);
    expect(scored.map((r) => r.rank)).toEqual([1, 2]);
    expect((scored[0].score ?? 0) >= (scored[1].score ?? 0)).toBe(true);
    const unscored = data.items.filter((r) => r.status === "DNS");
    expect(unscored).toHaveLength(5);
    expect(unscored.every((r) => r.score === null)).toBe(true);
    expect(Math.min(...unscored.map((r) => r.rank))).toBe(3);
  });

  it("holds verification while a scorecard is still a draft", async () => {
    await asOrganizer();
    const data = await call<ApiCompetitionResults>(
      "GET",
      `/competitions/${BEAUTY}/results`,
    );
    expect(data.actions.verify).toBe(false);
    await expect(
      call("POST", `/competitions/${BEAUTY}/results/verify`, {}),
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
