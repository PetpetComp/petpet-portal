import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApiCompetition } from "@/domains/competitions/types";
import type {
  ApiEntry,
  ApiEventEntries,
  ApiOwnerSearchResult,
} from "@/domains/entries/types";
import { mockRequest } from "./mock-request";
import { DEMO_PASSWORD } from "./mock-store";

/** End-to-end through the fake backend: same paths and shapes as contract 10. */
const EVENT = "evt-jakarta-pet-festival";
const BEAUTY = "comp-beauty-class-open";

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

const entries = (query: string) =>
  call<ApiEventEntries>("GET", `/events/${EVENT}/entries?${query}`);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T03:00:00Z"));
});
afterAll(() => vi.useRealTimers());

describe("GET /events/{uuid}/entries", () => {
  it("lists the check-in query: approved, registered, by pet name, with summary", async () => {
    await asOrganizer();
    const page = await entries(
      `competition_id=${BEAUTY}&eligibility_status=APPROVED&status=REGISTERED&sort=pet_name&direction=asc&per_page=12`,
    );
    expect(page.items).toHaveLength(12);
    const names = page.items.map((e) => e.pet_name ?? "");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(page.meta).toEqual({
      current_page: 1,
      per_page: 12,
      total: 17,
      last_page: 2,
    });
    // Summary ignores every filter but competition_id, and never counts withdrawn entries.
    expect(page.summary).toEqual({ total: 21, approved: 17, checked_in: 7 });
    const chibi = page.items.find((e) => e.pet_name === "Chibi")!;
    expect(chibi).toMatchObject({
      competition_name: "Beauty Class Open",
      owner_name: "Alya Maulana",
      pet_morph_name: "Classic Grey",
      registration_fee: "75000.00",
      checkin_status: "CHECKED_IN",
      // ONGOING: no undo; checked in: no check-in.
      actions: { check_in: false, undo_check_in: false },
    });
    const mika = page.items.find((e) => e.pet_name === "Mika")!;
    expect(mika.actions.check_in).toBe(true);
  });

  it("matches q exactly on participant code and partly on names", async () => {
    await asOrganizer();
    const byCode = await entries(`competition_id=${BEAUTY}&q=PTC-21-004`);
    expect(byCode.items.map((e) => e.pet_name)).toEqual(["Mika"]);
    expect((await entries(`competition_id=${BEAUTY}&q=PTC-21`)).items).toEqual(
      [],
    );
    const byOwner = await entries(
      `competition_id=${BEAUTY}&q=alya&sort=pet_name`,
    );
    expect(byOwner.items.map((e) => e.pet_name)).toEqual(["Bubu", "Chibi"]);
  });

  it("defaults to newest first and pages of 15", async () => {
    await asOrganizer();
    const page = await entries("");
    expect(page.meta.per_page).toBe(15);
    const times = page.items.map((e) => e.registered_at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("rejects a competition of another event (422) and outsiders (403)", async () => {
    await asOrganizer();
    await expect(
      entries("competition_id=comp-best-in-show-cat"),
    ).rejects.toMatchObject({ status: 422 });
    await asCompetitor();
    await expect(entries("")).rejects.toMatchObject({ status: 403 });
  });
});

describe("GET /events/{uuid}/owner-search", () => {
  const search = (q: string) =>
    call<{ items: ApiOwnerSearchResult[] }>(
      "GET",
      `/events/${EVENT}/owner-search?q=${q}`,
    );

  it("needs two characters and returns owners with their pets", async () => {
    await asOrganizer();
    expect((await search("a")).items).toEqual([]);
    const { items } = await search("alya");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Alya Maulana",
      email: "alya.maulana@petpet.dev",
      phone: "081311110001",
    });
    expect(items[0].pets).toContainEqual({
      uuid: "pet-chibi",
      name: "Chibi",
      species_name: "Sugar Glider",
      morph_name: "Classic Grey",
    });
  });

  it("is for event staff only", async () => {
    await asCompetitor();
    await expect(search("alya")).rejects.toMatchObject({ status: 403 });
  });
});

describe("POST /competitions/{uuid}/entries", () => {
  it("lets staff register someone else's pet at the active period's price", async () => {
    await asOrganizer();
    const entry = await call<ApiEntry>(
      "POST",
      "/competitions/comp-agility-sprint/entries",
      { pet_id: "pet-luna" },
    );
    expect(entry).toMatchObject({
      owner_uuid: "u-competitor",
      registration_period_uuid: "per-agility-onsite",
      registration_fee: "80000.00",
      participant_code: "PTC-11-005",
      eligibility_status: "PENDING",
      actions: { approve: true, reject: true },
    });
    await expect(
      call("POST", "/competitions/comp-agility-sprint/entries", {
        pet_id: "pet-luna",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("refuses closed registration (422) and strangers' pets (403)", async () => {
    await asCompetitor();
    await expect(
      call("POST", `/competitions/${BEAUTY}/entries`, { pet_id: "pet-bolt" }),
    ).rejects.toMatchObject({
      status: 422,
      message: "This competition is not open for registration.",
    });
    await expect(
      call("POST", "/competitions/comp-agility-sprint/entries", {
        pet_id: "pet-chibi",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("check-in and undo", () => {
  it("checks in on an ongoing competition, where undo is not allowed", async () => {
    await asOrganizer();
    const entry = await call<ApiEntry>(
      "POST",
      "/entries/entry-beauty-class-open-004/checkin",
    );
    expect(entry.checkin_status).toBe("CHECKED_IN");
    expect(entry.checked_in_at).toMatch(/\+00:00$/);
    expect(entry.actions.undo_check_in).toBe(false);
    await expect(
      call("POST", "/entries/entry-beauty-class-open-004/undo-checkin"),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("undoes a check-in before the competition starts", async () => {
    await asCompetitor();
    await expect(
      call("POST", "/entries/entry-agility-sprint-002/undo-checkin"),
    ).rejects.toMatchObject({ status: 403 });
    await asOrganizer();
    const entry = await call<ApiEntry>(
      "POST",
      "/entries/entry-agility-sprint-002/undo-checkin",
    );
    expect(entry).toMatchObject({
      checkin_status: "NOT_CHECKED_IN",
      checked_in_at: null,
      actions: { check_in: true },
    });
  });
});

describe("competitions", () => {
  const list = async () =>
    (
      await call<{ items: ApiCompetition[] }>(
        "GET",
        `/events/${EVENT}/competitions?per_page=100`,
      )
    ).items;
  const byId = async (uuid: string) =>
    (await list()).find((c) => c.uuid === uuid)!;

  it("reports the registration window and actions", async () => {
    await asOrganizer();
    const agility = await byId("comp-agility-sprint");
    expect(agility).toMatchObject({
      registration_open: true,
      active_registration_period: {
        uuid: "per-agility-onsite",
        period_type: "ON_SITE",
        price: "80000.00",
      },
      actions: {
        publish: false,
        start: true,
        complete: false,
        close_registration: true,
        cancel: true,
      },
    });
    expect((await byId(BEAUTY)).registration_closed_reason).toBe(
      "NOT_SCHEDULED",
    );
    expect(
      (await byId("comp-glider-mini-agility")).registration_closed_reason,
    ).toBe("FULL");
    expect(
      (await byId("comp-obedience-trial")).registration_closed_reason,
    ).toBe("CLOSED_BY_ORGANIZER");
  });

  it("runs lifecycle actions behind the same rules", async () => {
    await asCompetitor();
    expect((await byId("comp-costume-parade")).actions.publish).toBe(false);
    await expect(
      call("POST", "/competitions/comp-costume-parade/publish"),
    ).rejects.toMatchObject({ status: 403 });

    await asOrganizer();
    await call("POST", "/competitions/comp-costume-parade/publish");
    expect((await byId("comp-costume-parade")).status).toBe("SCHEDULED");
    await call("POST", "/competitions/comp-costume-parade/close-registration");
    expect((await byId("comp-costume-parade")).registration_closed_reason).toBe(
      "CLOSED_BY_ORGANIZER",
    );
    await call("POST", "/competitions/comp-costume-parade/start");
    await call("POST", "/competitions/comp-costume-parade/complete");
    expect((await byId("comp-costume-parade")).status).toBe("COMPLETED");
    await expect(
      call("DELETE", "/competitions/comp-costume-parade"),
    ).rejects.toMatchObject({ status: 422 });
    await call("DELETE", "/competitions/comp-obedience-trial");
    expect((await byId("comp-obedience-trial")).status).toBe("CANCELLED");
  });
});
