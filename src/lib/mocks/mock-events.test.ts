import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  cancelEventRecord,
  createEventRecord,
  eventPhase,
  listEventRecords,
  publishEventRecord,
  updateEventRecord,
} from "./mock-events";
import { store } from "./mock-store";
import type { MockUser } from "./mock-types";

/** "Sekarang" tetap supaya fase tidak berubah mengikuti tanggal mesin: 10 Okt 2026, tengah hari lokal. */
const NOW = new Date(2026, 9, 10, 12, 0);
const local = (y: number, m: number, d: number, h = 9) =>
  new Date(y, m - 1, d, h).toISOString();

const admin = store.users.find(
  (u) => u.email === "admin@petpet.dev",
) as MockUser;
const organizer = store.users.find(
  (u) => u.email === "organizer@petpet.dev",
) as MockUser;
const competitor = store.users.find(
  (u) => u.email === "competitor@petpet.dev",
) as MockUser;

const query = (params: Record<string, string> = {}) =>
  new URLSearchParams(params);

const snapshot = [...store.events];
afterEach(() => {
  // Kembalikan data seed: tes di bawah menambah/mengubah event.
  store.events = [...snapshot];
});

describe("eventPhase", () => {
  const published = (start: string, end: string) => ({
    status: "PUBLISHED" as const,
    start_at: start,
    end_at: end,
  });
  it("is EVENT_DAY when today falls inside the schedule, even for multi-day events", () => {
    expect(
      eventPhase(
        published(local(2026, 10, 10, 8), local(2026, 10, 10, 18)),
        NOW,
      ),
    ).toBe("EVENT_DAY");
    expect(
      eventPhase(published(local(2026, 10, 5), local(2026, 11, 6)), NOW),
    ).toBe("EVENT_DAY");
  });
  it("is UPCOMING before today and FINISHED after", () => {
    expect(
      eventPhase(published(local(2026, 10, 11), local(2026, 10, 11, 18)), NOW),
    ).toBe("UPCOMING");
    expect(
      eventPhase(published(local(2026, 10, 9), local(2026, 10, 9, 18)), NOW),
    ).toBe("FINISHED");
  });
  it("ignores the dates for Draft and Cancelled", () => {
    const dates = {
      start_at: local(2026, 10, 10),
      end_at: local(2026, 10, 10),
    };
    expect(eventPhase({ status: "DRAFT", ...dates }, NOW)).toBe("DRAFT");
    expect(eventPhase({ status: "CANCELLED", ...dates }, NOW)).toBe(
      "CANCELLED",
    );
  });
});

describe("listEventRecords", () => {
  it("returns the contract fields and a summary", () => {
    const list = listEventRecords(query(), NOW);
    expect(list.items[0]).toHaveProperty("code");
    expect(list.items[0]).toHaveProperty("organization_name");
    expect(list.items[0]).toHaveProperty("phase");
    expect(list.summary?.all).toBe(store.events.length);
    const { event_day, upcoming, draft, finished } = list.summary!;
    // Event Cancelled hanya muncul di "all": empat tab tidak harus berjumlah all.
    expect(event_day + upcoming + draft + finished).toBeLessThanOrEqual(
      list.summary!.all,
    );
  });
  it("filters by phase but keeps the tab counts of the other phases", () => {
    const all = listEventRecords(query(), NOW);
    const drafts = listEventRecords(query({ phase: "DRAFT" }), NOW);
    expect(drafts.items.every((e) => e.phase === "DRAFT")).toBe(true);
    expect(drafts.meta.total).toBe(all.summary!.draft);
    expect(drafts.summary).toEqual(all.summary);
  });
  it("sorts by start date, newest first by default", () => {
    const starts = listEventRecords(query({ per_page: "100" }), NOW).items.map(
      (e) => new Date(e.start_at).getTime(),
    );
    expect(starts).toEqual([...starts].sort((a, b) => b - a));
  });
  it("sorts by name ascending", () => {
    const names = listEventRecords(
      query({ sort: "name", per_page: "100" }),
      NOW,
    ).items.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("searches name, code, venue and organizer text", () => {
    expect(
      listEventRecords(query({ q: "paw race" }), NOW).items.map((e) => e.name),
    ).toEqual(["Surabaya Paw Race 2026"]);
    expect(
      listEventRecords(query({ q: "senayan" }), NOW).items.map((e) => e.name),
    ).toEqual(["Jakarta Glider Show 2026"]);
    const org = store.organizations[0].name.toLowerCase();
    expect(listEventRecords(query({ q: org }), NOW).meta.total).toBeGreaterThan(
      0,
    );
  });
  it("filters by name or code, venue, month and organization", () => {
    const code = listEventRecords(query(), NOW).items[0].code as string;
    expect(listEventRecords(query({ name: code }), NOW).meta.total).toBe(1);
    expect(listEventRecords(query({ venue: "Palur" }), NOW).meta.total).toBe(1);
    const october = listEventRecords(query({ month: "2026-10" }), NOW).items;
    expect(october.length).toBeGreaterThan(0);
    expect(
      october.every(
        (e) =>
          new Date(e.start_at) < new Date(2026, 10, 1) &&
          new Date(e.end_at) >= new Date(2026, 9, 1),
      ),
    ).toBe(true);
    const orgId = store.organizations[0].uuid;
    expect(
      listEventRecords(
        query({ organization_id: orgId, per_page: "100" }),
        NOW,
      ).items.every((e) => e.organization_uuid === orgId),
    ).toBe(true);
  });
  it("pages the result", () => {
    const page = listEventRecords(query({ per_page: "5", page: "2" }), NOW);
    expect(page.items).toHaveLength(5);
    expect(page.meta).toMatchObject({ current_page: 2, per_page: 5 });
  });
  it("rejects an unknown phase", () => {
    expect(() => listEventRecords(query({ phase: "SOON" }), NOW)).toThrow(
      ApiError,
    );
  });
});

describe("createEventRecord", () => {
  const body = {
    name: "Brand New Event",
    start_at: "2026-12-01T01:00:00.000Z",
    end_at: "2026-12-01T10:00:00.000Z",
    timezone: "Asia/Jakarta",
    tagline: null,
    organization_id: store.organizations[0].uuid,
  };
  it("creates a Draft event under an existing organization (super admin)", () => {
    const created = createEventRecord(admin, body);
    expect(created).toMatchObject({
      name: "Brand New Event",
      status: "DRAFT",
      phase: "DRAFT",
      organization_name: store.organizations[0].name,
    });
    expect(created.code).toMatch(/^EVT-2026-\d{4}$/);
  });
  it("creates a new organization when asked", () => {
    const before = store.organizations.length;
    createEventRecord(admin, {
      ...body,
      organization_id: undefined,
      new_organization: { name: "Fresh Club" },
    });
    expect(store.organizations).toHaveLength(before + 1);
    store.organizations.pop();
  });
  it("rejects a duplicate name, ignoring case, with a 422 on name", () => {
    const existing = store.events[0].name.toUpperCase();
    try {
      createEventRecord(admin, { ...body, name: existing });
      expect.unreachable();
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect((cause as ApiError).status).toBe(422);
      expect((cause as ApiError).errors?.name).toBeDefined();
    }
  });
  it("rejects an end that is not after the start", () => {
    try {
      createEventRecord(admin, { ...body, end_at: body.start_at });
      expect.unreachable();
    } catch (cause) {
      expect((cause as ApiError).errors?.end_at).toBeDefined();
    }
  });
  it("answers 403 for someone without event.create or without a role in the organization", () => {
    expect(() => createEventRecord(competitor, body)).toThrow(/permission/);
    const otherOrg = store.organizations.find(
      (o) => !o.pics.some((p) => p.user_uuid === organizer.uuid),
    )!;
    expect(() =>
      createEventRecord(organizer, { ...body, organization_id: otherOrg.uuid }),
    ).toThrow(/permission/);
  });
});

describe("updateEventRecord", () => {
  it("changes the details and keeps the name unique", () => {
    const event = store.events.find((e) => e.status === "DRAFT")!;
    const updated = updateEventRecord(admin, event.uuid, {
      name: "Renamed Draft",
      tagline: null,
    });
    expect(updated.name).toBe("Renamed Draft");
    expect(updated.tagline).toBeNull();
    const other = store.events.find((e) => e.uuid !== event.uuid)!;
    expect(() =>
      updateEventRecord(admin, event.uuid, { name: other.name }),
    ).toThrow(ApiError);
  });
  it("allows keeping the same name", () => {
    const event = store.events[0];
    expect(() =>
      updateEventRecord(admin, event.uuid, { name: event.name }),
    ).not.toThrow();
  });
  it("forbids someone who does not manage the event", () => {
    const event = store.events.find(
      (e) =>
        !store.organizations
          .find((o) => o.uuid === e.organization_uuid)
          ?.pics.some((p) => p.user_uuid === organizer.uuid),
    )!;
    expect(() =>
      updateEventRecord(organizer, event.uuid, { name: "Hijack" }),
    ).toThrow(/permission/);
  });
});

describe("publishEventRecord and cancelEventRecord", () => {
  it("publishes a draft and its draft competitions, once", () => {
    const draft = store.events.find((e) => e.status === "DRAFT")!;
    const competition = store.competitions[0];
    const previous = {
      event: competition.event_uuid,
      status: competition.status,
    };
    competition.event_uuid = draft.uuid;
    competition.status = "DRAFT";
    try {
      expect(publishEventRecord(admin, draft.uuid).status).toBe("PUBLISHED");
      expect(competition.status).toBe("SCHEDULED");
      expect(() => publishEventRecord(admin, draft.uuid)).toThrow(
        /draft event/,
      );
    } finally {
      competition.event_uuid = previous.event;
      competition.status = previous.status;
    }
  });
  it("cancels instead of deleting", () => {
    const event = store.events[0];
    cancelEventRecord(admin, event.uuid);
    expect(store.events).toContain(event);
    expect(event.status).toBe("CANCELLED");
  });
});
