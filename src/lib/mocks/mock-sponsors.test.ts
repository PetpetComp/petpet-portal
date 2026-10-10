import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  addEventSponsorRecord,
  listEventSponsorRecords,
  removeEventSponsorRecord,
} from "./mock-sponsors";
import { store } from "./mock-store";
import type { MockUser } from "./mock-types";

const EVENT = "evt-surabaya-paw-race";

const admin = store.users.find(
  (u) => u.email === "admin@petpet.dev",
) as MockUser;
const competitor = store.users.find(
  (u) => u.email === "competitor@petpet.dev",
) as MockUser;

const snapshot = [...store.eventSponsors];
afterEach(() => {
  // Kembalikan data seed: tes di bawah menambah/menghapus tautan.
  store.eventSponsors = [...snapshot];
});

/** Menjalankan fungsi dan mengembalikan ApiError yang dilempar (gagal bila tidak melempar). */
function failure(run: () => unknown): ApiError {
  try {
    run();
  } catch (cause) {
    if (cause instanceof ApiError) return cause;
    throw cause;
  }
  throw new Error("Expected an ApiError");
}

describe("listEventSponsorRecords", () => {
  it("returns a flat array of the event's links in the API shape", () => {
    const rows = listEventSponsorRecords(EVENT);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({
      event_uuid: EVENT,
      status: "ACTIVE",
      display_order: 0,
      campaign_text: null,
    });
  });

  it("seeds the design's mix of tiers for Surabaya Paw Race", () => {
    const count = (level: string) =>
      listEventSponsorRecords(EVENT).filter(
        (r) => r.sponsorship_level === level,
      ).length;
    expect([
      count("PLATINUM"),
      count("GOLD"),
      count("SILVER"),
      count("BRONZE"),
      count("MEDIA_PARTNER"),
    ]).toEqual([2, 2, 1, 1, 2]);
  });
});

describe("addEventSponsorRecord", () => {
  it("links a brand with a tier and shows it in the list", () => {
    const created = addEventSponsorRecord(admin, EVENT, {
      sponsor_id: "spo-royal-canin",
      sponsorship_level: "BRONZE",
    });
    expect(created).toMatchObject({
      sponsor_uuid: "spo-royal-canin",
      sponsorship_level: "BRONZE",
      status: "ACTIVE",
    });
    expect(listEventSponsorRecords(EVENT)).toHaveLength(9);
  });

  it("answers 403 to a caller who may not edit the event, before looking at the data", () => {
    const error = failure(() =>
      addEventSponsorRecord(competitor, EVENT, {
        sponsor_id: "spo-kibbleworks",
        sponsorship_level: "GOLD",
      }),
    );
    expect(error.status).toBe(403);
  });

  it("answers 404 for an unknown brand", () => {
    const error = failure(() =>
      addEventSponsorRecord(admin, EVENT, {
        sponsor_id: "nope",
        sponsorship_level: "GOLD",
      }),
    );
    expect(error.status).toBe(404);
  });

  it("answers 422 for an unknown tier", () => {
    const error = failure(() =>
      addEventSponsorRecord(admin, EVENT, {
        sponsor_id: "spo-royal-canin",
        sponsorship_level: "DIAMOND",
      }),
    );
    expect(error.status).toBe(422);
  });

  it("answers 422 when the brand is already linked to the event", () => {
    const error = failure(() =>
      addEventSponsorRecord(admin, EVENT, {
        sponsor_id: "spo-kibbleworks",
        sponsorship_level: "GOLD",
      }),
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe("This sponsor is already linked to this event.");
  });
});

describe("removeEventSponsorRecord", () => {
  it("removes a link of the event", () => {
    removeEventSponsorRecord(admin, EVENT, "evtspo-surabaya-1");
    expect(listEventSponsorRecords(EVENT)).toHaveLength(7);
  });

  it("answers 404 when the link belongs to another event", () => {
    const error = failure(() =>
      removeEventSponsorRecord(admin, EVENT, "evtspo-2"),
    );
    expect(error.status).toBe(404);
  });

  it("answers 403 to a caller who may not edit the event", () => {
    const error = failure(() =>
      removeEventSponsorRecord(competitor, EVENT, "evtspo-surabaya-1"),
    );
    expect(error.status).toBe(403);
  });
});
