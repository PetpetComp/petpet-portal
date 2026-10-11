import { afterEach, describe, expect, it } from "vitest";
import { buildDrawing } from "@/domains/drawing/draw";
import { lockBody } from "@/domains/drawing/api";
import type { ApiDrawing } from "@/domains/drawing/types";
import {
  drawingStore,
  eligibleEntries,
  laneLimit,
  resetDrawingStore,
} from "./mock-drawing";
import { mockRequest } from "./mock-request";
import { DEMO_PASSWORD, store } from "./mock-store";

/** Dari ujung ke ujung lewat backend palsu: path dan bentuk sama dengan draf kontrak drawing. */
const SPRINT = "comp-glider-sprint-heats"; // Race, SCHEDULED, registrasi tutup, SUDAH di-lock (11 peserta)
const DERBY = "comp-glider-derby"; // Race, SCHEDULED, registrasi tutup, BELUM di-lock (13 peserta)
const BEAUTY = "comp-beauty-class-open"; // bukan Race
const CAT_RELAY = "comp-cat-agility-relay"; // Race, CANCELLED

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

const get = (uuid: string) =>
  call<ApiDrawing>("GET", `/competitions/${uuid}/drawing`);
const lock = (uuid: string, matches: string[][]) =>
  call<ApiDrawing>("POST", `/competitions/${uuid}/drawing`, lockBody(matches));
const swap = (uuid: string, a: string, b: string) =>
  call<ApiDrawing>("POST", `/competitions/${uuid}/drawing/swap`, {
    entry_uuid_a: a,
    entry_uuid_b: b,
  });
/** Susunan acak (berbenih) dari semua peserta yang berhak di kompetisi itu. */
const shuffleFor = (uuid: string, seed = 1) =>
  buildDrawing(
    eligibleEntries(uuid).map((e) => e.uuid),
    laneLimit(uuid),
    seed,
  );

// Tes mengubah kompetisi dan drawing: kembalikan setelah tiap tes.
const seedCompetitions = structuredClone(store.competitions);
const seedEntriesCopy = structuredClone(store.entries);
afterEach(() => {
  store.competitions = structuredClone(seedCompetitions);
  store.entries = structuredClone(seedEntriesCopy);
  resetDrawingStore();
});

describe("seed", () => {
  it("has one locked drawing (4+4+3 on 5 lanes) and one open Race to draw", async () => {
    await asOrganizer();
    const locked = await get(SPRINT);
    expect(locked.status).toBe("LOCKED");
    expect(locked.lanes).toBe(5);
    expect(locked.matches.map((m) => m.lanes.length)).toEqual([4, 4, 3]);
    expect(locked.matches.every((m) => m.status === "SCHEDULED")).toBe(true);
    const open = await get(DERBY);
    expect(open.status).toBe("NOT_DRAWN");
    expect(open.matches).toEqual([]);
    expect(open.participants).toHaveLength(13);
  });
});

describe("GET /competitions/{uuid}/drawing", () => {
  it("needs a login", async () => {
    await call("POST", "/auth/logout");
    await expect(get(SPRINT)).rejects.toMatchObject({ status: 401 });
  });

  it("answers 403 for an account unrelated to the event", async () => {
    await asCompetitor();
    await expect(get(SPRINT)).rejects.toMatchObject({ status: 403 });
  });

  it("answers 404 for an unknown competition", async () => {
    await asOrganizer();
    await expect(get("comp-nope")).rejects.toThrow();
  });

  it("answers 422 for a competition that is not a Race", async () => {
    await asOrganizer();
    await expect(get(BEAUTY)).rejects.toMatchObject({ status: 422 });
  });

  it("returns the locked drawing with names, bibs and every pet exactly once", async () => {
    await asOrganizer();
    const data = await get(SPRINT);
    expect(data.locked_by_name).toBe("Organizer Demo");
    expect(data.lock_blocked_reason).toBe("ALREADY_LOCKED");
    expect(data.actions).toEqual({ lock: false, swap: true });
    const lanes = data.matches.flatMap((m) => m.lanes);
    expect(new Set(lanes.map((l) => l.entry_uuid)).size).toBe(11);
    expect(lanes.every((l) => l.pet_name && l.owner_name && l.bib_number)).toBe(
      true,
    );
    expect(data.matches[0].lanes.map((l) => l.lane_number)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(data.matches.map((m) => m.match_number)).toEqual([1, 2, 3]);
  });

  it("lists only approved, paid, checked-in, registered entries as participants", async () => {
    await asOrganizer();
    const sprint = await get(SPRINT);
    // Tofu (belum check-in) tidak ikut.
    expect(sprint.participants.map((p) => p.pet_name)).not.toContain("Tofu");
    expect(sprint.participants).toHaveLength(11);
    const derby = await get(DERBY);
    const names = derby.participants.map((p) => p.pet_name);
    for (const out of ["Mika", "Nana", "Niko", "Kona"])
      expect(names).not.toContain(out);
    const bibs = derby.participants.map((p) => p.bib_number as string);
    expect(bibs).toEqual([...bibs].sort());
  });

  it("offers Lock on the open Race and says why not when it cannot", async () => {
    await asOrganizer();
    const derby = await get(DERBY);
    expect(derby.actions).toEqual({ lock: true, swap: false });
    expect(derby.lock_blocked_reason).toBeNull();
    store.competitions.find((c) => c.uuid === DERBY)!.registration_closed_at =
      null;
    const open = await get(DERBY);
    expect(open.lock_blocked_reason).toBe("REGISTRATION_OPEN");
    expect(open.actions.lock).toBe(false);
  });

  it("defaults to 4 lanes when the rule has no lane_total", async () => {
    await asOrganizer();
    expect(laneLimit("comp-agility-sprint")).toBe(4);
    expect(laneLimit("no-such-competition")).toBe(4);
  });
});

describe("POST /competitions/{uuid}/drawing (lock)", () => {
  it("locks the whole drawing in one request and returns it", async () => {
    await asOrganizer();
    const matches = shuffleFor(DERBY);
    expect(matches.map((m) => m.length)).toEqual([5, 4, 4]);
    const data = await lock(DERBY, matches);
    expect(data.status).toBe("LOCKED");
    expect(data.locked_by_name).toBe("Organizer Demo");
    expect(data.locked_at).not.toBeNull();
    expect(data.matches.map((m) => m.lanes.map((l) => l.entry_uuid))).toEqual(
      matches,
    );
    expect(data.actions).toEqual({ lock: false, swap: true });
    // Tetap ada setelah dibaca ulang.
    expect((await get(DERBY)).status).toBe("LOCKED");
  });

  it("answers 409 when the drawing is already locked", async () => {
    await asOrganizer();
    await expect(lock(SPRINT, shuffleFor(SPRINT))).rejects.toMatchObject({
      status: 409,
    });
    await lock(DERBY, shuffleFor(DERBY));
    await expect(lock(DERBY, shuffleFor(DERBY, 2))).rejects.toMatchObject({
      status: 409,
    });
  });

  it("answers 403 for an account that may not manage the competition", async () => {
    await asCompetitor();
    await expect(lock(DERBY, shuffleFor(DERBY))).rejects.toMatchObject({
      status: 403,
    });
    expect(drawingStore.drawings[DERBY]).toBeUndefined();
  });

  it("answers 422 for a competition that is not a Race", async () => {
    await asOrganizer();
    await expect(lock(BEAUTY, [["x"]])).rejects.toMatchObject({ status: 422 });
  });

  it("answers 422 while registration is still open", async () => {
    await asOrganizer();
    store.competitions.find((c) => c.uuid === DERBY)!.registration_closed_at =
      null;
    await expect(lock(DERBY, shuffleFor(DERBY))).rejects.toMatchObject({
      status: 422,
    });
  });

  it("answers 422 for a cancelled competition", async () => {
    await asOrganizer();
    await expect(lock(CAT_RELAY, [["x"]])).rejects.toMatchObject({
      status: 422,
    });
  });

  it("answers 422 when nobody is checked in and paid", async () => {
    await asOrganizer();
    for (const e of store.entries.filter((e) => e.competition_uuid === DERBY))
      e.checkin_status = "NOT_CHECKED_IN";
    const data = await get(DERBY);
    expect(data.lock_blocked_reason).toBe("NO_PARTICIPANTS");
    await expect(lock(DERBY, [["x"]])).rejects.toMatchObject({ status: 422 });
  });

  it("rejects a body that misses, repeats or invents a participant", async () => {
    await asOrganizer();
    const ok = shuffleFor(DERBY);
    const missing = ok.map((m) => [...m]);
    missing[0].pop();
    await expect(lock(DERBY, missing)).rejects.toMatchObject({ status: 422 });
    const repeated = ok.map((m) => [...m]);
    repeated[1][0] = repeated[0][0];
    await expect(lock(DERBY, repeated)).rejects.toMatchObject({ status: 422 });
    const invented = ok.map((m) => [...m]);
    invented[0][0] = "entry-not-in-this-competition";
    await expect(lock(DERBY, invented)).rejects.toMatchObject({ status: 422 });
    await expect(lock(DERBY, [])).rejects.toMatchObject({ status: 422 });
    // Lebih dari jumlah lane (5) dalam satu match.
    const flat = ok.flat();
    await expect(lock(DERBY, [flat])).rejects.toMatchObject({ status: 422 });
    expect(drawingStore.drawings[DERBY]).toBeUndefined();
  });
});

describe("POST /competitions/{uuid}/drawing/swap", () => {
  const firstTwo = async () => {
    const data = await get(SPRINT);
    const [m1, m2] = data.matches;
    return { a: m1.lanes[0].entry_uuid, b: m2.lanes[1].entry_uuid };
  };

  it("swaps two participants between matches and keeps their lanes", async () => {
    await asOrganizer();
    const { a, b } = await firstTwo();
    const data = await swap(SPRINT, a, b);
    expect(data.matches[0].lanes[0].entry_uuid).toBe(b);
    expect(data.matches[1].lanes[1].entry_uuid).toBe(a);
    const all = data.matches.flatMap((m) => m.lanes.map((l) => l.entry_uuid));
    expect(new Set(all).size).toBe(11);
    expect((await get(SPRINT)).matches[0].lanes[0].entry_uuid).toBe(b);
  });

  it("answers 409 before the drawing is locked", async () => {
    await asOrganizer();
    const [a, b] = eligibleEntries(DERBY).map((e) => e.uuid);
    await expect(swap(DERBY, a, b)).rejects.toMatchObject({ status: 409 });
  });

  it("answers 409 when one of the matches already started", async () => {
    await asOrganizer();
    const { a, b } = await firstTwo();
    drawingStore.drawings[SPRINT].matches[1].status = "IN_PROGRESS";
    await expect(swap(SPRINT, a, b)).rejects.toMatchObject({ status: 409 });
    expect(drawingStore.drawings[SPRINT].matches[0].entry_uuids[0]).toBe(a);
  });

  it("answers 422 for the same pet twice, a missing field or a stranger", async () => {
    await asOrganizer();
    const { a } = await firstTwo();
    await expect(swap(SPRINT, a, a)).rejects.toMatchObject({ status: 422 });
    await expect(
      call("POST", `/competitions/${SPRINT}/drawing/swap`, { entry_uuid_a: a }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(swap(SPRINT, a, "entry-unknown")).rejects.toMatchObject({
      status: 422,
    });
  });

  it("answers 403 for an account that may not manage the competition", async () => {
    await asOrganizer();
    const { a, b } = await firstTwo();
    await asCompetitor();
    await expect(swap(SPRINT, a, b)).rejects.toMatchObject({ status: 403 });
  });

  it("drops the swap action once every match started", async () => {
    await asOrganizer();
    for (const m of drawingStore.drawings[SPRINT].matches)
      m.status = "COMPLETED";
    expect((await get(SPRINT)).actions.swap).toBe(false);
  });
});

describe("reopen registration (finding D6)", () => {
  it("deletes the locked drawing, so the competition can be drawn again", async () => {
    await asOrganizer();
    expect((await get(SPRINT)).status).toBe("LOCKED");
    await call("POST", `/competitions/${SPRINT}/reopen-registration`, {});
    const data = await get(SPRINT);
    expect(data.status).toBe("NOT_DRAWN");
    expect(data.matches).toEqual([]);
    expect(data.lock_blocked_reason).toBe("REGISTRATION_OPEN");
    // Tutup lagi lalu undi ulang.
    await call("POST", `/competitions/${SPRINT}/close-registration`, {});
    const again = await lock(SPRINT, shuffleFor(SPRINT, 9));
    expect(again.status).toBe("LOCKED");
  });

  it("keeps the drawing when the reopen is refused", async () => {
    await asCompetitor();
    await expect(
      call("POST", `/competitions/${SPRINT}/reopen-registration`, {}),
    ).rejects.toMatchObject({ status: 403 });
    expect(drawingStore.drawings[SPRINT]).toBeDefined();
  });
});
