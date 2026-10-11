import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  addBrandPicRecord,
  createBrandRecord,
  deactivateBrandRecord,
  getBrandRecord,
  listBrandRecords,
  removeBrandPicRecord,
  updateBrandRecord,
  validateBrandBody,
} from "./mock-brands";
import { listEventSponsorRecords } from "./mock-sponsors";
import { store } from "./mock-store";
import type { MockUser } from "./mock-types";

const admin = store.users.find(
  (u) => u.email === "admin@petpet.dev",
) as MockUser;
const organizer = store.users.find(
  (u) => u.email === "organizer@petpet.dev",
) as MockUser;

const snapshot = store.sponsors.map((brand) => ({
  ...brand,
  pics: [...brand.pics],
}));
afterEach(() => {
  // Kembalikan data seed: tes di bawah membuat, mengubah, dan menonaktifkan brand.
  store.sponsors = snapshot.map((brand) => ({
    ...brand,
    pics: [...brand.pics],
  }));
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

const query = (init = "") => new URLSearchParams(init);

describe("listBrandRecords", () => {
  it("returns active brands sorted by name in the SponsorData shape with paging meta", () => {
    const page = listBrandRecords(query("per_page=8"));
    const names = page.items.map((b) => b.brand_name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(page.items).toHaveLength(8);
    expect(page.meta.per_page).toBe(8);
    expect(page.meta.last_page).toBeGreaterThan(1);
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        uuid: expect.any(String),
        brand_name: expect.any(String),
        status: "ACTIVE",
        pics: expect.any(Array),
      }),
    );
  });

  it("defaults to 15 rows per page like the backend", () => {
    expect(listBrandRecords(query()).meta.per_page).toBe(15);
  });

  it("pages through the list without losing or repeating a brand", () => {
    const first = listBrandRecords(query("per_page=8&page=1"));
    const second = listBrandRecords(query("per_page=8&page=2"));
    const ids = [...first.items, ...second.items].map((b) => b.uuid);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("searches name, campaign and handle without regard to case (mock only)", () => {
    const byName = listBrandRecords(query("q=KIBBLE")).items;
    expect(byName.map((b) => b.uuid)).toContain("spo-kibbleworks");
    const byCampaign = listBrandRecords(query("q=power every")).items;
    expect(byCampaign.map((b) => b.brand_name)).toEqual(["PawFuel"]);
    const byHandle = listBrandRecords(query("q=tailtreats")).items;
    expect(byHandle.map((b) => b.brand_name)).toEqual(["TailTreats"]);
    expect(listBrandRecords(query("q=zzzz")).meta.total).toBe(0);
  });

  it("hides inactive brands, like the backend list", () => {
    deactivateBrandRecord(admin, "spo-pawfuel");
    const all = listBrandRecords(query("per_page=100")).items;
    expect(all.map((b) => b.uuid)).not.toContain("spo-pawfuel");
  });

  it("keeps every brand the event Sponsors tab links to", () => {
    const listed = new Set(
      listBrandRecords(query("per_page=100")).items.map((b) => b.uuid),
    );
    for (const link of listEventSponsorRecords("evt-surabaya-paw-race"))
      expect(listed.has(link.sponsor_uuid)).toBe(true);
  });
});

describe("getBrandRecord", () => {
  it("returns one brand with PIC name and email taken from the user", () => {
    const brand = getBrandRecord("spo-whiskas-indonesia");
    expect(brand.pics).toEqual([
      {
        user_uuid: "u-sponsor",
        name: expect.any(String),
        email: "sponsor@petpet.dev",
      },
    ]);
  });

  it("answers 404 for an unknown brand", () => {
    expect(failure(() => getBrandRecord("nope")).status).toBe(404);
  });

  it("opens an inactive brand too", () => {
    deactivateBrandRecord(admin, "spo-pawfuel");
    expect(getBrandRecord("spo-pawfuel").status).toBe("INACTIVE");
  });
});

describe("validateBrandBody", () => {
  it("requires brand_name on create", () => {
    const error = failure(() => validateBrandBody({}, false));
    expect(error.status).toBe(422);
    expect(error.errors?.brand_name).toEqual([
      "The brand name field is required.",
    ]);
  });

  it("checks max lengths and formats with Laravel-style messages", () => {
    const error = failure(() =>
      validateBrandBody(
        {
          brand_name: "x".repeat(201),
          phone: "1".repeat(31),
          email: "nope",
          website_url: "brand.com",
        },
        false,
      ),
    );
    expect(Object.keys(error.errors ?? {}).sort()).toEqual([
      "brand_name",
      "email",
      "phone",
      "website_url",
    ]);
  });

  it("on PATCH only checks brand_name when it is sent", () => {
    expect(validateBrandBody({ phone: "0812" }, true)).toEqual({
      phone: "0812",
    });
    expect(
      failure(() => validateBrandBody({ brand_name: "" }, true)).status,
    ).toBe(422);
  });

  it("drops fields the backend does not accept", () => {
    expect(
      validateBrandBody(
        { brand_name: "A", campaign: "x", status: "INACTIVE" },
        false,
      ),
    ).toEqual({ brand_name: "A" });
  });
});

describe("createBrandRecord", () => {
  it("creates an ACTIVE brand with no PICs", () => {
    const before = store.sponsors.length;
    const brand = createBrandRecord(admin, {
      brand_name: " Glide Gear ",
      email: "hi@glide.dev",
    });
    expect(brand).toMatchObject({
      brand_name: "Glide Gear",
      email: "hi@glide.dev",
      phone: null,
      status: "ACTIVE",
      pics: [],
    });
    expect(store.sponsors).toHaveLength(before + 1);
  });

  it("refuses a caller without master.manage with 403", () => {
    expect(
      failure(() => createBrandRecord(organizer, { brand_name: "X" })).status,
    ).toBe(403);
  });

  it("validates before checking permission, like the FormRequest does", () => {
    expect(failure(() => createBrandRecord(organizer, {})).status).toBe(422);
  });
});

describe("updateBrandRecord", () => {
  it("changes only the fields that were sent and can clear optional ones", () => {
    const brand = updateBrandRecord(admin, "spo-royal-canin", {
      phone: "0899",
      website_url: null,
    });
    expect(brand.phone).toBe("0899");
    expect(brand.website_url).toBeNull();
    expect(brand.brand_name).toBe("Royal Canin Indonesia");
    expect(brand.email).toBe("partnership@royalcanin.petpet.dev");
  });

  it("answers 403 without permission and 404 for an unknown brand", () => {
    expect(
      failure(() =>
        updateBrandRecord(organizer, "spo-royal-canin", { phone: "1" }),
      ).status,
    ).toBe(403);
    expect(
      failure(() => updateBrandRecord(admin, "nope", { phone: "1" })).status,
    ).toBe(404);
  });

  it("cannot change status through PATCH", () => {
    const brand = updateBrandRecord(admin, "spo-royal-canin", {
      status: "INACTIVE",
    });
    expect(brand.status).toBe("ACTIVE");
  });
});

describe("deactivateBrandRecord", () => {
  it("sets INACTIVE and returns the brand", () => {
    expect(deactivateBrandRecord(admin, "spo-pawmart").status).toBe("INACTIVE");
  });

  it("answers 422 when the brand is already inactive", () => {
    deactivateBrandRecord(admin, "spo-pawmart");
    const error = failure(() => deactivateBrandRecord(admin, "spo-pawmart"));
    expect(error.status).toBe(422);
    expect(error.message).toBe("This sponsor is already inactive.");
  });

  it("checks permission first (403), then the brand (404)", () => {
    expect(failure(() => deactivateBrandRecord(organizer, "nope")).status).toBe(
      403,
    );
    expect(failure(() => deactivateBrandRecord(admin, "nope")).status).toBe(
      404,
    );
  });

  it("leaves event sponsor links untouched", () => {
    const before = listEventSponsorRecords("evt-surabaya-paw-race").length;
    deactivateBrandRecord(admin, "spo-kibbleworks");
    expect(listEventSponsorRecords("evt-surabaya-paw-race")).toHaveLength(
      before,
    );
  });
});

describe("PICs", () => {
  const competitor = store.users.find(
    (u) => u.email === "competitor@petpet.dev",
  ) as MockUser;

  it("adds a PIC and the brand then lists it with name and email", () => {
    expect(
      addBrandPicRecord(admin, "spo-pawfuel", { user_id: competitor.uuid }),
    ).toBeNull();
    const pics = getBrandRecord("spo-pawfuel").pics;
    expect(pics).toHaveLength(1);
    expect(pics[0]).toMatchObject({
      user_uuid: competitor.uuid,
      email: competitor.email,
    });
  });

  it("validates user_id (422) before permission (403)", () => {
    expect(
      failure(() => addBrandPicRecord(organizer, "spo-pawfuel", {})).status,
    ).toBe(422);
    expect(
      failure(() =>
        addBrandPicRecord(admin, "spo-pawfuel", { user_id: "ghost" }),
      ).errors?.user_id,
    ).toEqual(["The selected user id is invalid."]);
    expect(
      failure(() =>
        addBrandPicRecord(organizer, "spo-pawfuel", {
          user_id: competitor.uuid,
        }),
      ).status,
    ).toBe(403);
  });

  it("answers 404 for an unknown brand and 422 for a duplicate PIC", () => {
    expect(
      failure(() =>
        addBrandPicRecord(admin, "nope", { user_id: competitor.uuid }),
      ).status,
    ).toBe(404);
    addBrandPicRecord(admin, "spo-pawfuel", { user_id: competitor.uuid });
    expect(
      failure(() =>
        addBrandPicRecord(admin, "spo-pawfuel", { user_id: competitor.uuid }),
      ).status,
    ).toBe(422);
  });

  it("removes a PIC, and removing a non-PIC still succeeds like the backend", () => {
    addBrandPicRecord(admin, "spo-pawfuel", { user_id: competitor.uuid });
    expect(
      removeBrandPicRecord(admin, "spo-pawfuel", competitor.uuid),
    ).toBeNull();
    expect(getBrandRecord("spo-pawfuel").pics).toEqual([]);
    expect(
      removeBrandPicRecord(admin, "spo-pawfuel", competitor.uuid),
    ).toBeNull();
  });

  it("answers 403 without permission when removing", () => {
    expect(
      failure(() =>
        removeBrandPicRecord(organizer, "spo-whiskas-indonesia", "u-sponsor"),
      ).status,
    ).toBe(403);
  });
});
